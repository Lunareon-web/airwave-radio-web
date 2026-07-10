'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';

// Module-level ref so NowPlaying can seek without prop drilling
export const ytCommand: {
  send: ((func: string, args?: unknown[]) => void) | null;
  /** Call after a manual seek so the local timer resets its baseline
   *  and doesn't revert the slider to the pre-seek position. */
  syncSeek: ((time: number) => void) | null;
} = { send: null, syncSeek: null };

interface YTPlayerProps {
  onReady?: () => void;
  /** When true the component renders only the bare iframe (no wrapper div).
   *  Use inside a parent that controls dimensions (e.g. flex-1 container). */
  fillContainer?: boolean;
}

/**
 * Both audio mode and video mode use the YT iframe.
 *
 * The native <audio> approach was designed to let us own the Media Session so
 * Chrome Android shows [⏮][⏸][⏭] on the lock screen.  That approach relied on
 * Piped / Invidious proxies, which have completely shut down, and on server-side
 * URL extraction via ytdl-core / InnerTube, which Google now blocks for all cloud
 * provider IPs via the PO Token requirement.
 *
 * The same Media Session goal is now achieved via the
 *   Permissions-Policy: mediasession=(self)
 * header set in next.config.ts.  This blocks the cross-origin YouTube iframe from
 * calling setActionHandler / setting MediaMetadata, so our page-level registrations
 * in assertMediaSession (page.tsx) are never overridden.
 *
 * Audio mode renders the iframe hidden (display:none) — identical playback to
 * video mode but without the visible video element.
 */
export function YTPlayer({ onReady, fillContainer = false }: YTPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ytReadyRef = useRef(false);
  // Prevents firing playNext() multiple times in the 2s pre-end window
  const nearEndFiredRef = useRef(false);
  // Counts consecutive 429s so we stop retrying after 5 in a row
  const consecutive429Ref = useRef(0);
  // Tracks the last YT-reported time & wall-clock stamp for local interpolation
  const lastYtRef = useRef<{ time: number; ms: number }>({ time: 0, ms: 0 });
  // After a manual seek, ignore infoDelivery currentTime updates for 800 ms so the
  // pre-seek position that YouTube sends before processing seekTo doesn't snap the slider back.
  const seekBlockUntilRef = useRef(0);
  // Web Worker for the progress timer — less throttled than main-thread setInterval
  // when the browser tab is hidden/minimized.
  const workerRef = useRef<Worker | null>(null);
  // Background-safe track switching: keep ONE iframe alive and switch tracks
  // via loadVideoById instead of remounting (remount = new iframe = autoplay
  // blocked by Chrome in hidden tabs; loadVideoById reuses the existing player
  // session that already has the user's autoplay grant).
  const firstVideoIdRef   = useRef<string | null>(null);
  const isFirstVideoRef   = useRef(true);
  const prevPlaybackModeRef = useRef<string>('');

  const {
    activeSource, activeIndex, isPlaying, volume, isMuted,
    setIsPlaying, setCurrentTime, setDuration, playNext,
    getCurrentTrack, settings, getSourceTracks, updateTrackInSource,
    setResolveMessage,
  } = useAppStore();

  const currentTrack = getCurrentTrack();
  const videoId = currentTrack?.videoId;
  const isVideoMode = settings.playbackMode === 'video';

  // Detect playback-mode switch during render. The controls= parameter lives in
  // the iframe src, so mode changes require a new iframe (and reset the
  // "first video" state so the new iframe starts fresh via autoplay=1).
  if (settings.playbackMode !== prevPlaybackModeRef.current) {
    prevPlaybackModeRef.current = settings.playbackMode;
    firstVideoIdRef.current     = null;
    isFirstVideoRef.current     = true;
  }

  // Build a STABLE iframe src: only the very first video (or the first video
  // after a mode change) goes into the URL. All subsequent tracks are loaded
  // via the loadVideoById API command, which keeps the player session alive so
  // Chrome's background-tab autoplay block never applies to track changes.
  if (videoId && !firstVideoIdRef.current) firstVideoIdRef.current = videoId;
  const embedUrl = firstVideoIdRef.current
    ? `https://www.youtube.com/embed/${firstVideoIdRef.current}?enablejsapi=1&autoplay=1` +
      `&controls=${isVideoMode ? 1 : 0}&rel=0&modestbranding=1` +
      `&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
    : null;

  // Send commands to iframe
  const sendCommand = useCallback((func: string, args?: unknown[]) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: args || [] }),
      '*'
    );
  }, []);

  // Register for external use (seek + sync from NowPlaying / Media Session).
  // Both modes use the iframe, so both paths call sendCommand.
  useEffect(() => {
    ytCommand.send = sendCommand;
    ytCommand.syncSeek = (time: number) => {
      lastYtRef.current = { time, ms: Date.now() };
      // Block stale pre-seek infoDelivery events for 800 ms
      seekBlockUntilRef.current = Date.now() + 800;
    };
    return () => { ytCommand.send = null; ytCommand.syncSeek = null; };
  }, [sendCommand]);

  // Listen for messages from the YT iframe.
  // NOTE: We check event.origin (not event.source) because on Android Chrome
  // cross-origin iframes run in separate renderer processes and window object
  // reference comparison can fail, silently dropping all YT events.
  const handleMessage = useCallback((event: MessageEvent) => {
    if (
      event.origin !== 'https://www.youtube.com' &&
      event.origin !== 'https://www.youtube-nocookie.com'
    ) return;
    if (!iframeRef.current) return;
    if (!event.data || typeof event.data !== 'string') return;
    let data: { event?: string; info?: Record<string, unknown> };
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.event === 'initialDelivery' || data.event === 'infoDelivery') {
      const info = data.info || {};
      if (typeof info.currentTime === 'number') {
        if (Date.now() < seekBlockUntilRef.current) {
          lastYtRef.current = { time: info.currentTime as number, ms: Date.now() };
        } else {
          const ct = info.currentTime as number;
          lastYtRef.current = { time: ct, ms: Date.now() };
          setCurrentTime(ct);
        }
      }

      const rawDur  = info.duration;
      const vidData = info.videoData as Record<string, unknown> | undefined;
      const parsedDur = typeof rawDur === 'number'
        ? rawDur
        : typeof rawDur === 'string'
          ? parseFloat(rawDur)
          : vidData?.lengthSeconds
            ? parseFloat(String(vidData.lengthSeconds))
            : 0;
      if (parsedDur > 0) setDuration(parsedDur);

      if (typeof info.playerState === 'number') {
        const state = info.playerState as number;
        const ct  = (info.currentTime as number) || 0;
        const dur = parsedDur || (info.duration as number) || 0;

        if (state === 1) {
          ytReadyRef.current = true;
          setIsPlaying(true);
          if (onReady) onReady();
          if (dur > 0 && dur - ct <= 2 && !nearEndFiredRef.current) {
            nearEndFiredRef.current = true;
            playNext();
          }
        } else if (state === 2) {
          if (dur > 0 && dur - ct <= 2) {
            if (!nearEndFiredRef.current) {
              nearEndFiredRef.current = true;
              playNext();
            }
          } else if (!useAppStore.getState().isPlaying) {
            setIsPlaying(false);
          }
        } else if (state === 0) {
          if (!nearEndFiredRef.current) playNext();
        }
      }
    }

    if (data.event === 'onStateChange') {
      const state = typeof data.info === 'number' ? (data.info as number) : -1;
      if (state === 1) {
        ytReadyRef.current = true;
        setIsPlaying(true);
        if (onReady) onReady();
      } else if (state === 0 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        playNext();
      }
    }

    if (data.event === 'onError') {
      console.warn(`[YT] onError code=${data.info} — skipping track`);
      if (!nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        setTimeout(() => useAppStore.getState().playNext(), 800);
      }
    }
  }, [setCurrentTime, setDuration, setIsPlaying, playNext, onReady]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // ── Background recovery ────────────────────────────────────────────────────
  // When the OS window / tab is hidden Chrome throttles JS timers AND may
  // suspend the iframe, preventing auto-advance.  On becoming visible again:
  //   1. If wall-clock says the track should have ended → call playNext() now
  //      (the throttled timer missed its window while hidden).
  //   2. Otherwise → re-send playVideo (covers the "iframe was paused" case).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      const store = useAppStore.getState();
      if (!store.isPlaying || !store.getCurrentTrack()?.videoId) return;

      const { time, ms } = lastYtRef.current;
      if (ms) {
        const staleSec = (Date.now() - ms) / 1000;
        const estimated = time + staleSec;
        const dur = store.duration;
        // Hidden for long enough that we're past the end — advance immediately.
        if (staleSec > 3 && dur > 0 && estimated >= dur - 1 && !nearEndFiredRef.current) {
          nearEndFiredRef.current = true;
          store.playNext();
          return;
        }
      }

      sendCommand('playVideo');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sendCommand]);

  // ── Progress timer ────────────────────────────────────────────────────────
  // Interpolates currentTime every 500 ms when playing.
  // Uses a Web Worker so Chrome's background-tab throttling (which clamps
  // main-thread setInterval to ≥1 s) doesn't affect the safety-net checks.
  // Falls back to setInterval if the Worker fails to load.
  //
  // Safety layers on top of the handleMessage near-end detection:
  //   a) Stale-event fallback — fires when YT events stopped ≥5 s ago and
  //      extrapolated wall-clock position reaches dur − 2.
  //   b) Ultimate safety-net — 5 s past end, belt-and-suspenders.
  useEffect(() => {
    if (!isPlaying || !videoId) {
      workerRef.current?.postMessage('stop');
      return;
    }

    const startMs   = Date.now();
    const startTime = useAppStore.getState().currentTime;

    const tick = () => {
      const { time, ms } = lastYtRef.current;
      const dur = useAppStore.getState().duration;
      let estimated: number;

      if (ms) {
        const staleSec = (Date.now() - ms) / 1000;
        estimated = time + staleSec;
        if (staleSec >= 1.2) setCurrentTime(estimated);

        // (a) Stale-event fallback
        if (staleSec >= 5 && dur > 0 && estimated >= dur - 2 && !nearEndFiredRef.current) {
          nearEndFiredRef.current = true;
          useAppStore.getState().playNext();
        }
      } else {
        const elapsed = (Date.now() - startMs) / 1000;
        estimated = startTime + elapsed;
        setCurrentTime(estimated);

        if (dur > 0 && estimated >= dur - 2 && !nearEndFiredRef.current) {
          nearEndFiredRef.current = true;
          useAppStore.getState().playNext();
        }
      }

      // (b) Ultimate safety-net
      if (dur > 0 && estimated > dur + 5 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }

      if (dur === 0 && Date.now() - startMs > 12 * 60_000 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }
    };

    let fallbackId: ReturnType<typeof setInterval> | null = null;
    try {
      if (!workerRef.current) {
        workerRef.current = new Worker('/timer-worker.js');
      }
      workerRef.current.onmessage = tick;
      workerRef.current.postMessage('start');
    } catch {
      fallbackId = setInterval(tick, 500);
    }

    return () => {
      workerRef.current?.postMessage('stop');
      if (fallbackId !== null) clearInterval(fallbackId);
    };
  }, [isPlaying, videoId, setCurrentTime]);

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── Play / Pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;
    if (isPlaying) sendCommand('playVideo');
    else sendCommand('pauseVideo');
  }, [isPlaying, videoId, sendCommand]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;
    if (isMuted) sendCommand('mute');
    else { sendCommand('unMute'); sendCommand('setVolume', [Math.round(volume * 100)]); }
  }, [volume, isMuted, videoId, sendCommand]);

  // ── Auto-resolve video IDs ────────────────────────────────────────────────
  // Fetch a YouTube videoId for current + next track so they're ready to play.
  useEffect(() => {
    if (!activeSource || activeIndex < 0) return;
    const tracks = getSourceTracks(activeSource);
    const storeSettings = useAppStore.getState().settings;

    for (let i = activeIndex; i < Math.min(activeIndex + 2, tracks.length); i++) {
      const track = tracks[i];
      if (!track) continue;
      const isActive = i === activeIndex;
      if (isActive ? track.status === 'searching' || track.status === 'ready' : track.status !== 'idle') continue;
      updateTrackInSource(activeSource, i, { status: 'searching' });
      if (isActive) setResolveMessage(`Searching: ${track.track}…`);

      const query = track.search_term || `${track.artist} ${track.track} official audio`;
      const headers: Record<string, string> = {};
      if (storeSettings.youtubeKey) headers['X-YouTube-Key'] = storeSettings.youtubeKey;

      fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { headers })
        .then(async (r) => ({ httpStatus: r.status, data: await r.json() as Record<string, unknown> }))
        .then(({ httpStatus, data }) => {
          if (data.videoId) {
            consecutive429Ref.current = 0;
            updateTrackInSource(activeSource, i, {
              status: 'ready',
              videoId: data.videoId as string,
              coverArt: (data.thumbnail as string) || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
              resolvedTitle: data.title as string,
            });
            if (i === activeIndex) {
              setResolveMessage(`▶ ${(data.title as string) || track.track}`);
              const dur = data.duration as number | undefined;
              if (typeof dur === 'number' && dur > 0) setDuration(dur);
            }
          } else if (httpStatus === 429) {
            consecutive429Ref.current += 1;
            updateTrackInSource(activeSource, i, { status: 'failed' });
            if (i === activeIndex) {
              if (consecutive429Ref.current >= 5) {
                setResolveMessage('⚠ YouTube-Kontingent erschöpft — bitte API-Key prüfen');
              } else {
                setResolveMessage('⚠ Quota erschöpft — überspringe Track…');
                setTimeout(() => {
                  if (useAppStore.getState().activeIndex === i) playNext();
                }, 2500);
              }
            }
          } else {
            updateTrackInSource(activeSource, i, { status: 'failed' });
            if (i === activeIndex) {
              setResolveMessage('Not found — skipping…');
              setTimeout(() => {
                if (useAppStore.getState().activeIndex === i) playNext();
              }, 1800);
            }
          }
        })
        .catch(() => {
          updateTrackInSource(activeSource, i, { status: 'failed' });
          if (i === activeIndex) {
            setResolveMessage('Search error — skipping…');
            setTimeout(() => {
              if (useAppStore.getState().activeIndex === i) playNext();
            }, 1800);
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, activeIndex]);

  // ── Per-track init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;
    lastYtRef.current       = { time: 0, ms: 0 };
    nearEndFiredRef.current = false;
    ytReadyRef.current      = false;

    const sendListening = () =>
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }), '*'
      );

    if (!isFirstVideoRef.current) {
      // ── Subsequent tracks: switch within the live player ──────────────────
      // loadVideoById reuses the existing player session. Because the player
      // was already playing (it has the user's autoplay grant), this works
      // even when the browser tab is in the background / minimised.
      const t1 = setTimeout(() => {
        sendCommand('loadVideoById', [{ videoId, startSeconds: 0 }]);
        sendCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
        sendListening();
      }, 100);
      // Retry if the player hasn't reported playing after 1.5 s
      const t2 = setTimeout(() => {
        if (!ytReadyRef.current) sendCommand('loadVideoById', [{ videoId, startSeconds: 0 }]);
      }, 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    // ── First video: iframe is loading for the first time ─────────────────
    isFirstVideoRef.current = false;
    const t1 = setTimeout(() => {
      sendCommand('playVideo');
      sendCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
      sendListening();
    }, 600);
    const t2 = setTimeout(() => {
      if (!ytReadyRef.current) { sendCommand('playVideo'); sendListening(); }
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // No track yet → nothing to render (effects still run)
  if (!videoId) return null;

  // ── Audio mode: visually hidden but rendered iframe ──────────────────────
  //
  // WHY NOT display:none?
  // Chrome removes display:none iframes from the rendering pipeline entirely.
  // The YouTube player's infoDelivery postMessage events slow to a trickle or
  // stop, so the 2-second pre-advance and near-end detection stop working.
  //
  // FIX: render the iframe as a 1×1 transparent pixel anchored to the
  // bottom-right corner.  Chrome keeps the element in the compositing tree
  // and the player JS keeps firing events at full rate.
  //
  // The Permissions-Policy: mediasession=(self) header (next.config.ts) blocks
  // this cross-origin iframe from overriding our Media Session handlers, so
  // [⏮][⏸][⏭] still work on the lock screen.
  if (!isVideoMode) {
    return (
      <iframe
        ref={iframeRef}
        key={settings.playbackMode}
        src={embedUrl!}
        allow="autoplay; encrypted-media"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '1px',
          height: '1px',
          border: 'none',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -999,
        }}
        title="YouTube audio"
      />
    );
  }

  // ── Video mode: visible iframe ────────────────────────────────────────────
  if (fillContainer) {
    return (
      <iframe
        ref={iframeRef}
        key={settings.playbackMode}
        src={embedUrl!}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-full h-full block"
        style={{ border: 'none' }}
        title="YouTube player"
      />
    );
  }
  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden" style={{ background: '#000' }}>
      <iframe
        ref={iframeRef}
        key={settings.playbackMode}
        src={embedUrl!}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-full h-full"
        title="YouTube player"
      />
    </div>
  );
}
