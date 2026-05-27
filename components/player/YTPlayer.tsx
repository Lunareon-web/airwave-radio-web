'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';

interface YTPlayerProps {
  onReady?: () => void;
}

export function YTPlayer({ onReady }: YTPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    activeSource, activeIndex, isPlaying, volume, isMuted,
    setIsPlaying, setCurrentTime, setDuration, playNext,
    getCurrentTrack, settings, getSourceTracks,
  } = useAppStore();

  const currentTrack = getCurrentTrack();
  const videoId = currentTrack?.videoId;
  const isVideoMode = settings.playbackMode === 'video';

  // Build YouTube embed URL
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${isPlaying ? 1 : 0}&controls=${isVideoMode ? 1 : 0}&rel=0&modestbranding=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
    : null;

  // Listen for messages from the YT iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data || typeof event.data !== 'string') return;
    let data: { event?: string; info?: Record<string, unknown> };
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.event === 'initialDelivery' || data.event === 'infoDelivery') {
      const info = data.info || {};
      if (typeof info.currentTime === 'number') {
        setCurrentTime(info.currentTime as number);
      }
      if (typeof info.duration === 'number') {
        setDuration(info.duration as number);
      }
      if (typeof info.playerState === 'number') {
        const state = info.playerState as number;
        const currentTime = (info.currentTime as number) || 0;
        const duration = (info.duration as number) || 0;
        if (state === 1) {
          setIsPlaying(true);
        } else if (state === 2) {
          // Near-end fix: if paused within 2s of end, treat as ended
          if (duration > 0 && duration - currentTime <= 2) {
            playNext();
          } else {
            setIsPlaying(false);
          }
        } else if (state === 0) {
          // Ended
          playNext();
        }
      }
      if (onReady && info.currentTime !== undefined) {
        onReady();
      }
    }
  }, [setCurrentTime, setDuration, setIsPlaying, playNext, onReady]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Send commands to iframe
  const sendCommand = useCallback((func: string, args?: unknown[]) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: args || [] }),
      '*'
    );
  }, []);

  // Play/pause control
  useEffect(() => {
    if (!videoId) return;
    if (isPlaying) {
      sendCommand('playVideo');
    } else {
      sendCommand('pauseVideo');
    }
  }, [isPlaying, videoId, sendCommand]);

  // Volume control
  useEffect(() => {
    if (!videoId) return;
    const vol = isMuted ? 0 : Math.round(volume * 100);
    sendCommand('setVolume', [vol]);
  }, [volume, isMuted, videoId, sendCommand]);

  // Auto-resolve video IDs for tracks that don't have one yet
  useEffect(() => {
    if (!activeSource || activeIndex < 0) return;
    const tracks = getSourceTracks(activeSource);
    const updateTrackInSource = useAppStore.getState().updateTrackInSource;
    const settings = useAppStore.getState().settings;

    // Resolve current + next 3 tracks
    for (let i = activeIndex; i < Math.min(activeIndex + 4, tracks.length); i++) {
      const track = tracks[i];
      if (track && track.status === 'idle') {
        updateTrackInSource(activeSource, i, { status: 'searching' });
        const query = track.search_term || `${track.artist} ${track.track} official`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (settings.youtubeKey) headers['X-YouTube-Key'] = settings.youtubeKey;
        fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { headers })
          .then((r) => r.json())
          .then((data) => {
            if (data.videoId) {
              updateTrackInSource(activeSource, i, {
                status: 'ready',
                videoId: data.videoId,
                coverArt: data.thumbnail,
                resolvedTitle: data.title,
              });
            } else {
              updateTrackInSource(activeSource, i, { status: 'failed' });
            }
          })
          .catch(() => updateTrackInSource(activeSource, i, { status: 'failed' }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, activeIndex]);

  if (!embedUrl) return null;

  if (isVideoMode) {
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

  // Audio mode: hidden iframe
  return (
    <iframe
      ref={iframeRef}
      key={videoId}
      src={embedUrl}
      allow="autoplay; encrypted-media"
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
      title="YouTube audio player"
    />
  );
}
