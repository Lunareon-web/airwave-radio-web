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

  // youtube-nocookie.com: privacy-enhanced embed that Chrome doesn't apply
  // its special "YouTube iframe" media-session override to — lets our Media
  // Session API handlers (prev/next) show in the lock screen notification.
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=${isVideoMode ? 1 : 0}&rel=0&modestbranding=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
    : null;

  // Send commands to iframe
  const sendCommand = useCallback((func: string, args?: unknown[]) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: args || [] }),
      '*'
    );
  }, []);

  // Register for external use (seek + sync from NowPlaying)
  useEffect(() => {
    ytCommand.send = sendCommand;
    ytCommand.syncSeek = (time: number) => {
      // Reset the local-timer baseline so it interpolates from the new position
      lastYtRef.current = { time, ms: Date.now() };
      // Block infoDelivery currentTime updates for 800 ms: YouTube sends the
      // pre-seek position before it processes our seekTo command; ignoring it
      // prevents the slider from snapping back to the old position.
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
    if (!iframeRef.current) return; // iframe not mounted
    if (!event.data || typeof event.data !== 'string') return;
    let data: { event?: string; info?: Record<string, unknown> };
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.event === 'initialDelivery' || data.event === 'infoDelivery') {
      const info = data.info || {};
      if (typeof info.currentTime === 'number') {
        // Skip stale pre-seek updates: YouTube sends the old position ~0–300 ms
        // after a seekTo command before it processes the seek; honour the block
        // window set by syncSeek() to prevent the slider snapping back.
        if (Date.now() < seekBlockUntilRef.current) {
          // Still update the baseline time so interpolation stays correct
          lastYtRef.current = { time: info.currentTime as number, ms: Date.now() };
        } else {
          const ct = info.currentTime as number;
          lastYtRef.current = { time: ct, ms: Date.now() };
          setCurrentTime(ct);
        }
      }

      // Duration: prefer info.duration (number), fall back to videoData.lengthSeconds (string)
      // Some YT embed versions / topic channels send duration only via videoData.
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
          // 2-second pre-advance: start next track before the current one ends
          if (dur > 0 && dur - ct <= 2 && !nearEndFiredRef.current) {
            nearEndFiredRef.current = true;
            playNext();
          }
        } else if (state === 2) {
          // YT sometimes fires pause ~1s before end — treat as ended
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

    // onStateChange: older/simpler YT event format
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

    // onError: video unavailable (100), embedding disabled (101 / 150), etc.
    // Skip to next track instead of silently freezing.
    if (data.event === 'onError') {
      const code = data.info;
      console.warn(`[YT] onError code=${code} — skipping track`);
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

  // Local timer: interpolates currentTime every 500 ms when playing.
  // Two modes:
  //   a) YT events flowing  → interpolate from last known position (if stale ≥1.2s)
  //   b) No YT events yet   → count up from store's currentTime at play-start
  // This ensures the progress bar is NEVER frozen even on Android where
  // postMessage events from hidden iframes may be delayed or absent.
  // Also includes a safety-net auto-advance for when YT state=0 (ended) is
  // never received (rare on Android with aggressive iframe throttling).
  useEffect(() => {
    if (!isPlaying || !videoId) return;
    const startMs   = Date.now();
    const startTime = useAppStore.getState().currentTime;

    const id = setInterval(() => {
      const { time, ms } = lastYtRef.current;
      let estimated: number;

      if (ms) {
        const staleSec = (Date.now() - ms) / 1000;
        estimated = time + staleSec;
        if (staleSec >= 1.2) setCurrentTime(estimated);
      } else {
        const elapsed = (Date.now() - startMs) / 1000;
        estimated = startTime + elapsed;
        setCurrentTime(estimated);
      }

      const dur = useAppStore.getState().duration;

      // Safety-net 1: 5+ s past the known duration (YT state=0 never arrived)
      if (dur > 0 && estimated > dur + 5 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }

      // Safety-net 2: duration never received at all (Android iframe throttling).
      // After 12 min of playing without a known end, advance to the next track.
      // Keeps the radio moving even when postMessage events are fully blocked.
      if (dur === 0 && Date.now() - startMs > 12 * 60_000 && !nearEndFiredRef.current) {
        nearEndFiredRef.current = true;
        useAppStore.getState().playNext();
      }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, videoId, setCurrentTime]);

  // Play/pause
  useEffect(() => {
    if (!videoId) return;
    if (isPlaying) sendCommand('playVideo');
    else sendCommand('pauseVideo');
  }, [isPlaying, videoId, sendCommand]);

  // Volume
  useEffect(() => {
    if (!videoId) return;
    const vol = isMuted ? 0 : Math.round(volume * 100);
    if (isMuted) sendCommand('mute');
    else { sendCommand('unMute'); sendCommand('setVolume', [vol]); }
  }, [volume, isMuted, videoId, sendCommand]);

  // Auto-resolve video IDs for current + next 5 tracks
  useEffect(() => {
    if (!activeSource || activeIndex < 0) return;
    const tracks = getSourceTracks(activeSource);
    const storeSettings = useAppStore.getState().settings;

    for (let i = activeIndex; i < Math.min(activeIndex + 2, tracks.length); i++) {
      const track = tracks[i];
      if (!track) continue;
      // For the current (active) track: also retry 'failed' status so a quota
      // error on a previous attempt doesn't permanently block playback.
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
            consecutive429Ref.current = 0; // reset on success
            updateTrackInSource(activeSource, i, {
              status: 'ready',
              videoId: data.videoId as string,
              coverArt: (data.thumbnail as string) || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
              resolvedTitle: data.title as string,
            });
            if (i === activeIndex) setResolveMessage(`▶ ${(data.title as string) || track.track}`);
          } else if (httpStatus === 429) {
            consecutive429Ref.current += 1;
            updateTrackInSource(activeSource, i, { status: 'failed' });
            if (i === activeIndex) {
              if (consecutive429Ref.current >= 5) {
                // 5 consecutive 429s — truly exhausted, stop the loop
                setResolveMessage('⚠ YouTube-Kontingent erschöpft — bitte API-Key prüfen');
              } else {
                // Try the next track — it might be cached or resolved via Invidious
                setResolveMessage(`⚠ Quota erschöpft — überspringe Track…`);
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
            // Network error or Vercel timeout — skip after a short pause,
            // just like the "not found" path (otherwise the track hangs forever).
            setTimeout(() => {
              if (useAppStore.getState().activeIndex === i) playNext();
            }, 1800);
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, activeIndex]);

  // Second play attempt after 2.5s if not yet playing (slow YT API init)
  useEffect(() => {
    if (!videoId) return;
    ytReadyRef.current = false;
    nearEndFiredRef.current = false;
    const t1 = setTimeout(() => {
      sendCommand('playVideo');
      sendCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
    }, 600);
    const t2 = setTimeout(() => {
      if (!ytReadyRef.current) sendCommand('playVideo');
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  if (!embedUrl) return null;

  if (isVideoMode) {
    // fillContainer: just the bare iframe — parent controls size/shape
    if (fillContainer) {
      return (
        <iframe
          ref={iframeRef}
          key={videoId}
          src={embedUrl}
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
          src={embedUrl}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full"
          title="YouTube player"
        />
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      key={videoId}
      src={embedUrl}
      allow="autoplay; encrypted-media"
      // top:0 left:0 keeps the 1×1 iframe inside the viewport.
      // Chrome Android throttles JS in iframes positioned outside the viewport
      // (-9999px), which blocks postMessage events and freezes the progress bar.
      style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none' }}
      title="YouTube audio player"
    />
  );
}
