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

  const {
    activeSource, activeIndex, isPlaying, volume, isMuted,
    setIsPlaying, setCurrentTime, setDuration, playNext,
    getCurrentTrack, settings, getSourceTracks, updateTrackInSource,
    setResolveMessage,
  } = useAppStore();

  const currentTrack = getCurrentTrack();
  const videoId = currentTrack?.videoId;
  const isVideoMode = settings.playbackMode === 'video';

  // controls=1 in video mode (shows YT UI); 0 in audio mode (hidden iframe, no UI needed).
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1` +
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
  // When the OS window is not in focus Chrome sets document.hidden=true and
  // throttles / freezes the background tab including our iframe.  Re-send
  // playVideo when the tab becomes visible again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      const store = useAppStore.getState();
      if (!store.isPlaying || !store.getCurrentTrack()?.videoId) return;
      sendCommand('playVideo');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sendCommand]);

  // ── Local timer ───────────────────────────────────────────────────────────
  // Interpolates currentTime every 500 ms when playing.
  // Two safety layers on top of the handleMessage near-end detection:
  //
  //   a) Stale-event fallback — fires the 2-second pre-advance when the YT
  //      iframe hasn't sent an infoDelivery event in ≥ 5 s (throttled/hidden)
  //      but the extrapolated wall-clock position reaches dur − 2.
  //
  //   b) Ultimate safety-net — fires if estimated position is still 5+ s past
  //      the known duration (belt-and-suspenders for extreme throttling).
  useEffect(() => {
    if (!isPlaying || !videoId) return;
    const startMs   = Date.now();
    const startTime = useAppStore.getState().currentTime;

    const id = setInterval(() => {
      const { time, ms } = lastYtRef.current;
      const dur = useAppStore.getState().duration;
      let estimated: number;

      if (ms) {
        const staleSec = (Date.now() - ms) / 1000;
        estimated = time + staleSec;
        if (staleSec >= 1.2) setCurrentTime(estimated);

        // (a) Stale-event fallback: events stopped flowing but extrapolated
        //     position says we're at the 2-second pre-advance window.
        if (staleSec >= 5 && dur > 0 && estimated >= dur - 2 && !nearEndFiredRef.current) {
          nearEndFiredRef.current = true;
          useAppStore.getState().playNext();
        }
      } else {
        // No events ever received — count from track start.
        const elapsed = (Date.now() - startMs) / 1000;
        estimated = startTime + elapsed;
        setCurrentTime(estimated);

        if (dur > 0 && estimated >= dur - 2 && !nearEndFiredRef.current) {
          nearEndFiredRef.current = true;
          useAppStore.getState().playNext();
        }
      }

      // (b) Ultimate safety-net: still past end despite (a) — advance anyway.
      if (dur > 0 && estimated > dur + 5 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }

      // Duration never received at all (iframe fully throttled for 12 min).
      if (dur === 0 && Date.now() - startMs > 12 * 60_000 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, videoId, setCurrentTime]);

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
  // Same YT iframe handshake for both audio and video modes.
  useEffect(() => {
    if (!videoId) return;
    lastYtRef.current       = { time: 0, ms: 0 };
    nearEndFiredRef.current = false;
    ytReadyRef.current      = false;

    const sendListening = () =>
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }), '*'
      );

    // 600 ms: iframe has normally loaded by now; send play + listening handshake.
    // 2500 ms: retry if ytReadyRef wasn't set (slow connection / throttled).
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
        key={videoId}
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
        key={videoId}
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
        key={videoId}
        src={embedUrl!}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-full h-full"
        title="YouTube player"
      />
    </div>
  );
}
