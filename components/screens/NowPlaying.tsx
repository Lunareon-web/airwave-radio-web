'use client';

import { useEffect, useState } from 'react';
import {
  SkipBack, SkipForward, Play, Pause,
  Heart, ThumbsDown, Shuffle,
  Volume2, VolumeX, Volume1,
  MoreHorizontal, Settings, Sparkles,
  Loader2, ListMusic,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Vinyl } from '@/components/ui/Vinyl';
import { Chip } from '@/components/ui/Chip';
import { FreqBars } from '@/components/ui/FreqBars';
import { YTPlayer, ytCommand } from '@/components/player/YTPlayer';
import type { MusicBubble } from '@/lib/types';

const SOURCE_LABEL: Record<string, string> = {
  discography: 'Discography',
  curated: 'Curated',
  queue: 'Queue',
  library: 'Library',
};

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlaying({ desktopMode = false }: { desktopMode?: boolean }) {
  // ── Which instance should own the YTPlayer? ──────────────────────────────
  // Both desktop and mobile <NowPlaying> are always mounted (display:none/flex).
  // Without this guard BOTH iframes play simultaneously → echo effect.
  // Rule: desktopMode instance owns it on ≥1024 px; mobile instance owns it on <1024 px.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = (e: MediaQueryList | MediaQueryListEvent) => setIsMobileViewport(e.matches);
    update(mq);
    mq.addEventListener('change', update as (e: MediaQueryListEvent) => void);
    return () => mq.removeEventListener('change', update as (e: MediaQueryListEvent) => void);
  }, []);
  // desktopMode XOR isMobileViewport → exactly one instance is true at any time
  const ownsPlayer = desktopMode !== isMobileViewport;

  const {
    isPlaying, setIsPlaying, currentTime, setCurrentTime, duration,
    playNext, playPrev, skipCurrent,
    getCurrentTrack, activeSource,
    likeTrack, unlikeTrack, dislikeTrack, undislikeTrack,
    library, settings, setShowSettings,
    advisorData, setAdvisorData, isAnalyzing, setIsAnalyzing,
    setCurrentPrompt, setActiveScreen,
    isShuffled, setIsShuffled,
    volume, setVolume, isMuted, setIsMuted,
    resolveMessage,
    addToQueue, setCuratedTracks, setActiveSource, setActiveIndex,
    setAddToPlaylistTrack,
  } = useAppStore();

  const track = getCurrentTrack();
  const trackId = track
    ? `${track.artist}__${track.track}`.toLowerCase().replace(/\s+/g, '_')
    : null;
  const isLiked    = trackId ? library.liked.some((t) => t.id === trackId) : false;
  const isDisliked = trackId ? library.disliked.includes(trackId) : false;
  const progress   = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ── Actions ── */
  const handleLike = () => {
    if (!track || !trackId) return;
    isLiked ? unlikeTrack(trackId) : likeTrack(track);
  };

  const handleDislike = () => {
    if (!track || !trackId) return;
    isDisliked ? undislikeTrack(trackId) : dislikeTrack(trackId);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    ytCommand.send?.('seekTo', [t, true]);
  };

  const handleStartRadio = () => {
    if (!track) return;
    setCurrentPrompt(`${track.artist} ${track.track} similar tracks radio`);
    setActiveScreen('muse');
  };

  const analyzeTrack = async () => {
    if (!track || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.geminiKey) headers['X-Gemini-Key'] = settings.geminiKey;
      const res = await fetch('/api/advisor/analyze', {
        method: 'POST', headers,
        body: JSON.stringify({ artist: track.artist, track: track.track }),
      });
      setAdvisorData(await res.json());
    } catch (e) { console.error('Advisor error:', e); }
    finally { setIsAnalyzing(false); }
  };

  const handleBubbleClick = (bubble: MusicBubble) => {
    const store = useAppStore.getState();
    if (bubble.type === 'artist') {
      store.setDiscographyQuery(bubble.value);
      store.setActiveScreen('library');
    } else if (bubble.type === 'song') {
      // label format: "Song Title (Artist Name)"  or value: "Artist - Track"
      const dashParts = bubble.value.split(' - ');
      const artist = dashParts[0]?.trim() || '';
      const trackName = dashParts.slice(1).join(' - ').trim() || bubble.label;
      store.addToQueue({ artist, track: trackName, status: 'idle' as const });
    } else {
      const prompt = advisorData?.seedPrompt || `${bubble.label}: ${bubble.value} music`;
      store.setCurrentPrompt(prompt);
      store.setActiveScreen('muse');
    }
  };

  /* ── Seek bar style ── */
  const seekStyle = {
    background: `linear-gradient(to right, #FF4D3D ${progress}%, rgba(0,0,0,0.15) ${progress}%)`,
    accentColor: '#FF4D3D',
  } as React.CSSProperties;

  const seekStyleLight = {
    background: `linear-gradient(to right, #FF4D3D ${progress}%, rgba(14,14,14,0.08) ${progress}%)`,
    accentColor: '#FF4D3D',
  } as React.CSSProperties;

  /* ── Shared transport buttons ── */
  const TransportRow = ({ light = false }: { light?: boolean }) => (
    <div className="flex items-center justify-between w-full px-1">
      <button onClick={handleDislike} title="Dislike">
        <ThumbsDown
          size={20}
          fill={isDisliked ? (light ? '#6B6B6B' : '#9A9A9A') : 'none'}
          color={light ? '#6B6B6B' : '#9A9A9A'}
        />
      </button>
      <button onClick={playPrev} style={{ color: light ? '#131313' : '#FFFFFF' }}>
        <SkipBack size={26} />
      </button>
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
        style={{ background: '#FF4D3D', boxShadow: '0 4px 16px rgba(255,77,61,0.4)' }}
      >
        {isPlaying
          ? <Pause size={24} color="white" fill="white" />
          : <Play  size={24} color="white" fill="white" />}
      </button>
      <button onClick={skipCurrent} style={{ color: light ? '#131313' : '#FFFFFF' }}>
        <SkipForward size={26} />
      </button>
      <button onClick={handleLike} title="Like">
        <Heart
          size={20}
          fill={isLiked ? '#FF4D3D' : 'none'}
          color={isLiked ? '#FF4D3D' : (light ? '#6B6B6B' : '#9A9A9A')}
        />
      </button>
    </div>
  );

  const ShuffleVolumeRow = ({ light = false }: { light?: boolean }) => (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={() => setIsShuffled(!isShuffled)}
        title="Shuffle"
        style={{ color: isShuffled ? '#FF4D3D' : (light ? '#6B6B6B' : '#9A9A9A'), flexShrink: 0 }}
      >
        <Shuffle size={18} />
      </button>
      <button
        onClick={() => setIsMuted(!isMuted)}
        style={{ color: light ? '#6B6B6B' : '#9A9A9A', flexShrink: 0 }}
      >
        {isMuted
          ? <VolumeX size={16} />
          : volume < 0.3 ? <Volume1 size={16} /> : <Volume2 size={16} />}
      </button>
      <input
        type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
        onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#FF4D3D' }}
      />
      <button
        onClick={handleStartRadio}
        title="Start similar radio"
        style={{ color: light ? '#6B6B6B' : '#9A9A9A', flexShrink: 0 }}
      >
        <Sparkles size={18} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2 overflow-y-auto">

      {/* ── Header (hidden in desktop mode — top bar handles navigation) ── */}
      {!desktopMode && (
        <div className="flex items-center justify-between mb-4">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#E8E6E1', color: '#6B6B6B' }}
            onClick={() => useAppStore.getState().setActiveScreen('queue')}
          >
            <MoreHorizontal size={18} />
          </button>

          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <FreqBars active={isPlaying} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>
                Now Broadcasting
              </span>
            </div>
            {activeSource && (
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#C2C0BB' }}>
                {SOURCE_LABEL[activeSource]} · {settings.playbackMode === 'video' ? 'Video' : 'Audio'}
              </span>
            )}
          </div>

          <button
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#E8E6E1', color: '#6B6B6B' }}
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} />
          </button>
        </div>
      )}

      {/* Desktop: compact source/status line */}
      {desktopMode && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <FreqBars active={isPlaying} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>
            Now Broadcasting
          </span>
          {activeSource && (
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#C2C0BB' }}>
              · {SOURCE_LABEL[activeSource]}
            </span>
          )}
        </div>
      )}

      {/* ── Video Mode ── */}
      {settings.playbackMode === 'video' && track?.videoId && ownsPlayer && (
        <div className="mb-4 rounded-2xl overflow-hidden" style={{ maxHeight: '42vh' }}>
          <YTPlayer />
        </div>
      )}

      {/* ── Video mode controls ── */}
      {settings.playbackMode === 'video' && (
        <div className="rounded-2xl p-4 mb-4 flex flex-col gap-3" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(14,14,14,0.06)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold truncate flex-1" style={{ color: '#131313' }}>
                {track?.track || 'No track'}
              </h2>
              {track && (
                <button
                  onClick={() => setAddToPlaylistTrack(track)}
                  title="Add to playlist"
                  className="flex-shrink-0 transition-opacity hover:opacity-70"
                  style={{ color: '#9A9A9A' }}
                >
                  <ListMusic size={16} />
                </button>
              )}
            </div>
            {track?.artist ? (
              <button
                className="text-sm truncate text-left w-full transition-colors hover:opacity-70"
                style={{ color: '#9A9A9A' }}
                onClick={() => {
                  if (!track?.artist) return;
                  const store = useAppStore.getState();
                  store.setDiscographyTracks([]);
                  store.setDiscographyArtist(null);
                  store.setDiscographyQuery(track.artist);
                  store.setActiveScreen('library');
                }}
                title={`Browse ${track.artist} discography`}
              >
                {track.artist}
              </button>
            ) : (
              <p className="text-sm truncate" style={{ color: '#9A9A9A' }}>{track?.artist}</p>
            )}
          </div>
          {/* Seek */}
          <div>
            <input
              type="range" min={0} max={duration || 100} value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={seekStyleLight}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: '#9A9A9A' }}>{formatTime(currentTime)}</span>
              <span className="text-[10px]" style={{ color: '#9A9A9A' }}>{formatTime(duration)}</span>
            </div>
          </div>
          <TransportRow light />
          <ShuffleVolumeRow light />
        </div>
      )}

      {/* ── Audio mode: Hero black card ── */}
      {settings.playbackMode === 'audio' && (
        <div
          className="rounded-3xl p-5 mb-4 flex flex-col items-center"
          style={{ background: '#0E0E0E', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        >
          {/* Vinyl */}
          <div className="mb-4">
            <Vinyl isPlaying={isPlaying} size={170} coverArt={track?.coverArt} artist={track?.artist || ''} />
          </div>

          {/* Track info */}
          <div className="text-center mb-3 w-full">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-extrabold mb-0.5 leading-tight truncate" style={{ color: '#FFFFFF' }}>
                {track?.track || 'No track selected'}
              </h2>
              {track && (
                <button
                  onClick={() => setAddToPlaylistTrack(track)}
                  title="Add to playlist"
                  className="mb-0.5 flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ color: '#6B6B6B' }}
                >
                  <ListMusic size={16} />
                </button>
              )}
            </div>
            {track?.artist ? (
              <button
                className="text-sm font-medium truncate max-w-full transition-colors hover:opacity-80"
                style={{ color: '#9A9A9A' }}
                onClick={() => {
                  if (!track?.artist) return;
                  const store = useAppStore.getState();
                  store.setDiscographyTracks([]);
                  store.setDiscographyArtist(null);
                  store.setDiscographyQuery(track.artist);
                  store.setActiveScreen('library');
                }}
                title={`Browse ${track.artist} discography`}
              >
                {track.artist}
              </button>
            ) : (
              <p className="text-sm font-medium truncate" style={{ color: '#9A9A9A' }}>
                Select a source to begin
              </p>
            )}
            {resolveMessage && (
              <p className="text-[10px] mt-1 truncate font-mono" style={{ color: '#555' }}>
                {track?.status === 'searching' && <Loader2 size={10} className="inline mr-1 animate-spin" />}
                {resolveMessage}
              </p>
            )}
          </div>

          {/* Seek bar */}
          <div className="w-full mb-3">
            <input
              type="range" min={0} max={duration || 100} value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={seekStyle}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: '#6B6B6B' }}>{formatTime(currentTime)}</span>
              <span className="text-[10px]" style={{ color: '#6B6B6B' }}>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="w-full mb-3">
            <TransportRow />
          </div>

          {/* Shuffle + Volume + Start Radio */}
          <div className="w-full">
            <ShuffleVolumeRow />
          </div>
        </div>
      )}

      {/* ── AI Advisor ── */}
      {/* ── AI Music Advisor ── */}
      {track && (
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(14,14,14,0.06)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#FF4D3D' }}>
                <Sparkles size={13} color="white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#131313' }}>AI Music Curator</p>
                {advisorData && (
                  <p className="text-[10px]" style={{ color: '#9A9A9A' }}>
                    {track.artist} · {track.track}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={analyzeTrack}
              disabled={isAnalyzing}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(255,77,61,0.12)', color: '#FF4D3D' }}
            >
              {isAnalyzing
                ? <><Loader2 size={11} className="inline mr-1 animate-spin" />Analyzing…</>
                : advisorData ? 'Refresh' : 'Analyze'}
            </button>
          </div>

          <AnimatePresence>
            {advisorData && (() => {
              // Group bubbles by type
              const byType = advisorData.bubbles.reduce<Record<string, typeof advisorData.bubbles>>((acc, b) => {
                (acc[b.type] = acc[b.type] || []).push(b);
                return acc;
              }, {});

              const SECTIONS = [
                {
                  key: 'genre', label: 'GENRE & STIL',
                  color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',
                  action: null,
                },
                {
                  key: 'mood', label: 'STIMMUNG',
                  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',
                  action: null,
                },
                {
                  key: 'artist', label: 'ÄHNLICHE KÜNSTLER',
                  color: '#10B981', bg: 'rgba(16,185,129,0.10)',
                  action: { label: '· Discography laden', onClick: (val: string) => {
                    const store = useAppStore.getState();
                    store.setDiscographyTracks([]);
                    store.setDiscographyArtist(null);
                    store.setDiscographyQuery(val);
                    store.setActiveScreen('library');
                  }},
                },
                {
                  key: 'era', label: 'ÄRA & BEWEGUNG',
                  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',
                  action: null,
                },
                {
                  key: 'song', label: 'VERWANDTE SONGS',
                  color: '#06B6D4', bg: 'rgba(6,182,212,0.10)',
                  action: { label: '· sofort abspielen', onClick: (val: string) => handleBubbleClick({ type: 'song', label: 'Similar Song', value: val }) },
                },
              ];

              return (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  {SECTIONS.map(({ key, label, color, bg, action }) => {
                    const items = byType[key];
                    if (!items?.length) return null;
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[10px] font-bold tracking-wider" style={{ color: '#9A9A9A' }}>
                            {label}
                          </p>
                          {action && (
                            <button
                              className="text-[10px] font-semibold transition-opacity hover:opacity-70"
                              style={{ color }}
                              onClick={() => action.onClick(items[0]?.value || '')}
                            >
                              {action.label}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((bubble, i) => (
                            <button
                              key={i}
                              onClick={() => key === 'artist'
                                ? action?.onClick(bubble.value)
                                : handleBubbleClick(bubble)
                              }
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 active:scale-95"
                              style={{ background: bg, color }}
                            >
                              {key === 'artist' && '👤 '}
                              {key === 'era'    && '⏱ '}
                              {key === 'song'   && '🎵 '}
                              {bubble.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Seed prompt chip */}
                  {advisorData.seedPrompt && (
                    <button
                      onClick={() => {
                        useAppStore.getState().setCurrentPrompt(advisorData!.seedPrompt!);
                        useAppStore.getState().setActiveScreen('muse');
                      }}
                      className="w-full mt-1 py-2 rounded-xl text-xs font-semibold text-center transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,77,61,0.08)', color: '#FF4D3D' }}
                    >
                      <Sparkles size={11} className="inline mr-1" />
                      Ähnliches Radio starten
                    </button>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* Hidden audio iframe — only ONE instance per page */}
      {settings.playbackMode === 'audio' && ownsPlayer && <YTPlayer />}

      <div className="h-24" />
    </div>
  );
}
