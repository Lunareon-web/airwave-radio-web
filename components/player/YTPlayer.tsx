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
  // Tracks the last YT-reported time & wall-clock stamp for local interpolation
  const lastYtRef = useRef<{ time: number; ms: number }>({ time: 0, ms: 0 });
  const {
    activeSource, activeIndex, isPlaying, volume, isMuted,
    setIsPlaying, setCurrentTime, setDuration, playNext,
    getCurrentTrack, settings, getSourceTracks, updateTrackInSource,
    setResolveMessage,
  } = useAppStore();

  const currentTrack = getCurrentTrack();
  const videoId = currentTrack?.videoId;
  const isVideoMode = settings.playbackMode === 'video';

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=${isVideoMode ? 1 : 0}&rel=0&modestbranding=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
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
        const ct = info.currentTime as number;
        lastYtRef.current = { time: ct, ms: Date.now() };
        setCurrentTime(ct);
      }
      if (typeof info.duration === 'number' && (info.duration as number) > 0) setDuration(info.duration as number);

      if (typeof info.playerState === 'number') {
        const state = info.playerState as number;
        const ct = (info.currentTime as number) || 0;
        const dur = (info.duration as number) || 0;

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
  useEffect(() => {
    if (!isPlaying || !videoId) return;
    // Capture baseline at the moment playback is confirmed
    const startMs   = Date.now();
    const startTime = useAppStore.getState().currentTime;

    const id = setInterval(() => {
      const { time, ms } = lastYtRef.current;
      if (ms) {
        // YT events have arrived — interpolate from last reported position
        const staleSec = (Date.now() - ms) / 1000;
        if (staleSec >= 1.2) {
          setCurrentTime(time + staleSec);
        }
      } else {
        // No YT event yet — estimate from when play started
        const elapsed = (Date.now() - startMs) / 1000;
        setCurrentTime(startTime + elapsed);
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

    for (let i = activeIndex; i < Math.min(activeIndex + 6, tracks.length); i++) {
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
            updateTrackInSource(activeSource, i, {
              status: 'ready',
              videoId: data.videoId as string,
              coverArt: (data.thumbnail as string) || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
              resolvedTitle: data.title as string,
            });
            if (i === activeIndex) setResolveMessage(`▶ ${(data.title as string) || track.track}`);
          } else if (httpStatus === 429) {
            // All API keys have hit their daily quota — stop the skip loop.
            // Continuing to skip is pointless since every track would fail identically.
            updateTrackInSource(activeSource, i, { status: 'failed' });
            if (i === activeIndex) {
              setResolveMessage('⚠ YouTube-Kontingent erschöpft — bitte API-Key prüfen');
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
          if (i === activeIndex) setResolveMessage('Search error — skipping…');
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
      style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      title="YouTube audio player"
    />
  );
}
