'use client';

import {
  SkipBack, SkipForward, Play, Pause,
  Heart, ThumbsDown, Shuffle,
  Volume2, VolumeX, Volume1,
  MoreHorizontal, Settings, Sparkles,
  Loader2,
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

export function NowPlaying() {
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

      {/* ── Header ── */}
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

      {/* ── Video Mode ── */}
      {settings.playbackMode === 'video' && track?.videoId && (
        <div className="mb-4 rounded-2xl overflow-hidden">
          <YTPlayer />
        </div>
      )}

      {/* ── Video mode controls ── */}
      {settings.playbackMode === 'video' && (
        <div className="rounded-2xl p-4 mb-4 flex flex-col gap-3" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(14,14,14,0.06)' }}>
          <div>
            <h2 className="text-base font-bold truncate" style={{ color: '#131313' }}>
              {track?.track || 'No track'}
            </h2>
            <p className="text-sm truncate" style={{ color: '#9A9A9A' }}>{track?.artist}</p>
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
            <h2 className="text-xl font-extrabold mb-0.5 leading-tight truncate" style={{ color: '#FFFFFF' }}>
              {track?.track || 'No track selected'}
            </h2>
            <p className="text-sm font-medium truncate" style={{ color: '#9A9A9A' }}>
              {track?.artist || 'Select a source to begin'}
            </p>
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
      {track && (
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(14,14,14,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#FF4D3D' }}>
                <Sparkles size={12} color="white" />
              </div>
              <span className="text-sm font-semibold" style={{ color: '#131313' }}>Why Muse picked this</span>
            </div>
            <button
              onClick={analyzeTrack}
              disabled={isAnalyzing}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(255,77,61,0.12)', color: '#FF4D3D' }}
            >
              {isAnalyzing ? 'Analyzing…' : advisorData ? 'Refresh' : 'Analyze'}
            </button>
          </div>

          <AnimatePresence>
            {advisorData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex flex-wrap gap-2">
                  {advisorData.bubbles.map((bubble, i) => (
                    <Chip
                      key={i}
                      variant={bubble.type === 'genre' ? 'dark' : bubble.type === 'mood' ? 'accent' : 'default'}
                      onClick={() => handleBubbleClick(bubble)}
                    >
                      {bubble.type === 'artist' && '🎤 '}
                      {bubble.type === 'song'   && '🎵 '}
                      {bubble.type === 'era'    && '📅 '}
                      {bubble.label}: {bubble.value}
                    </Chip>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Hidden audio iframe */}
      {settings.playbackMode === 'audio' && <YTPlayer />}

      <div className="h-24" />
    </div>
  );
}
