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

  // ── Desktop video mode: explicit 50 vh video, no scroll ─────────────────
  // NOTE: outer div intentionally has NO h-full — the player grid row uses
  // "auto" so it sizes to its content (video height + controls height).
  // h-full inside overflow-y-auto breaks flex-1, so we use explicit heights.
  if (desktopMode && settings.playbackMode === 'video') {
    return (
      <div className="flex flex-col">
        {/* Compact status header */}
        <div
          className="flex items-center justify-center gap-2 px-4 py-2"
          style={{ borderBottom: '1px solid #DCDBD7' }}
        >
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

        {/* ── Video container ──
            • Fixed 50 vh — matches "50% of site height" request
            • display:none collapses it (takes no space) while videoId resolves,
              but React still mounts YTPlayer inside so resolution effects run
            • When videoId resolves → display:block → video appears instantly  */}
        {ownsPlayer && (
          <div
            style={{
              height: '50vh',
              display: track?.videoId ? 'block' : 'none',
              background: '#0E0E0E',
              margin: '0.5rem 1rem',
              borderRadius: '0.75rem',
              overflow: 'hidden',
            }}
          >
            <YTPlayer fillContainer />
          </div>
        )}

        {/* Compact controls — always visible */}
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold truncate flex-1" style={{ color: '#131313' }}>
              {track?.track || 'No track'}
            </p>
            {track && (
              <button
                onClick={() => setAddToPlaylistTrack(track)}
                title="Add to playlist"
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: '#9A9A9A' }}
              >
                <ListMusic size={14} />
              </button>
            )}
          </div>
          {track?.artist ? (
            <button
              className="text-xs truncate text-left hover:opacity-70 transition-opacity -mt-1"
              style={{ color: '#9A9A9A' }}
              onClick={() => {
                const s = useAppStore.getState();
                s.setDiscographyTracks([]); s.setDiscographyArtist(null);
                s.setDiscographyQuery(track.artist); s.setActiveScreen('library');
              }}
              title={`Browse ${track.artist}`}
            >
              {track.artist}
            </button>
          ) : (
            <p className="text-xs -mt-1" style={{ color: '#9A9A9A' }}>Select a source to begin</p>
          )}
          <input
            type="range" min={0} max={duration || 100} value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={seekStyleLight}
          />
          <div className="flex justify-between -mt-1">
            <span className="text-[10px]" style={{ color: '#9A9A9A' }}>{formatTime(currentTime)}</span>
            <span className="text-[10px]" style={{ color: '#9A9A9A' }}>{formatTime(duration)}</span>
          </div>
          <TransportRow light />
          <ShuffleVolumeRow light />
        </div>
      </div>
    );
  }

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

      {/* ── Video Mode ── always mount YTPlayer so it can resolve the videoId itself */}
      {settings.playbackMode === 'video' && ownsPlayer && (
        <div
          className="mb-4 rounded-2xl overflow-hidden"
          style={{ display: track?.videoId ? 'block' : 'none' }}
        >
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

      {/* Hidden audio iframe — only ONE instance per page */}
      {settings.playbackMode === 'audio' && ownsPlayer && <YTPlayer />}

      {!desktopMode && <div className="h-24" />}
    </div>
  );
}
