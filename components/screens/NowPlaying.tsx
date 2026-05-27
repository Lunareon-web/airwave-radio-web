'use client';

import { useState, useEffect } from 'react';
import { SkipBack, SkipForward, Play, Pause, Heart, MoreHorizontal, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Vinyl } from '@/components/ui/Vinyl';
import { Chip } from '@/components/ui/Chip';
import { FreqBars } from '@/components/ui/FreqBars';
import { YTPlayer } from '@/components/player/YTPlayer';
import type { MusicBubble } from '@/lib/types';

const MOOD_PRESETS: Record<string, string[]> = {
  default: ['Chill Vibes', 'Energy Boost', 'Focus Mode', 'Late Night'],
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlaying() {
  const {
    isPlaying, setIsPlaying, currentTime, duration,
    playNext, playPrev, skipCurrent,
    getCurrentTrack, activeSource,
    likeTrack, unlikeTrack,
    library, settings, setShowSettings,
    advisorData, setAdvisorData, isAnalyzing, setIsAnalyzing,
    setCurrentPrompt, setCuratedTracks, setActiveSource, setActiveIndex,
  } = useAppStore();

  const track = getCurrentTrack();
  const isLiked = track ? library.liked.some(
    (t) => t.artist === track.artist && t.track === track.track
  ) : false;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleLike = () => {
    if (!track) return;
    if (isLiked) {
      const id = `${track.artist}__${track.track}`.toLowerCase().replace(/\s+/g, '_');
      unlikeTrack(id);
    } else {
      likeTrack(track);
    }
  };

  const analyzeTrack = async () => {
    if (!track || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.geminiKey) headers['X-Gemini-Key'] = settings.geminiKey;
      const res = await fetch('/api/advisor/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ artist: track.artist, track: track.track }),
      });
      const data = await res.json();
      setAdvisorData(data);
    } catch (e) {
      console.error('Advisor error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBubbleClick = async (bubble: MusicBubble) => {
    if (bubble.type === 'artist') {
      // Search discography
      const store = useAppStore.getState();
      store.setDiscographyQuery(bubble.value);
      store.setActiveScreen('library');
    } else if (bubble.type === 'song') {
      // Parse "Artist - Track" format
      const [artist, ...rest] = bubble.value.split(' - ');
      if (artist && rest.length) {
        const newTrack = { artist: artist.trim(), track: rest.join(' - ').trim(), status: 'idle' as const };
        store.addToQueue(newTrack);
      }
    } else {
      // Generate playlist from mood/genre/era
      const prompt = advisorData?.seedPrompt || `${bubble.label}: ${bubble.value} music`;
      setCurrentPrompt(prompt);
      store.setActiveScreen('muse');
    }
  };

  const store = useAppStore.getState();

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#E8E6E1', color: '#6B6B6B' }}
          onClick={() => store.setActiveScreen('queue')}
        >
          <MoreHorizontal size={18} />
        </button>
        <div className="flex items-center gap-2">
          <FreqBars active={isPlaying} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>
            Now Broadcasting
          </span>
        </div>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#E8E6E1', color: '#6B6B6B' }}
          onClick={() => setShowSettings(true)}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Video Mode */}
      {settings.playbackMode === 'video' && track?.videoId && (
        <div className="mb-6 rounded-2xl overflow-hidden">
          <YTPlayer />
        </div>
      )}

      {/* Hero Black Card */}
      {settings.playbackMode === 'audio' && (
        <div
          className="rounded-3xl p-6 mb-5 flex flex-col items-center"
          style={{ background: '#0E0E0E', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        >
          {/* Vinyl or cover */}
          <div className="mb-5">
            <Vinyl
              isPlaying={isPlaying}
              size={180}
              coverArt={track?.coverArt}
              artist={track?.artist || ''}
            />
          </div>

          {/* Track info */}
          <div className="text-center mb-5 w-full">
            <h2
              className="text-2xl font-extrabold mb-1 leading-tight truncate"
              style={{ color: '#FFFFFF' }}
            >
              {track?.track || 'No track selected'}
            </h2>
            <p className="text-sm font-medium truncate" style={{ color: '#9A9A9A' }}>
              {track?.artist || 'Select a source to begin'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full mb-4">
            <div
              className="relative w-full rounded-full overflow-hidden"
              style={{ height: 4, background: 'rgba(255,255,255,0.1)' }}
            >
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: '#FF4D3D', width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
              {/* Scrubber */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  background: '#FFFFFF',
                  left: `calc(${progress}% - 6px)`,
                  boxShadow: '0 0 4px rgba(0,0,0,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs" style={{ color: '#6B6B6B' }}>{formatTime(currentTime)}</span>
              <span className="text-xs" style={{ color: '#6B6B6B' }}>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between w-full px-2">
            <button onClick={handleLike}>
              <Heart
                size={22}
                fill={isLiked ? '#FF4D3D' : 'none'}
                color={isLiked ? '#FF4D3D' : '#6B6B6B'}
              />
            </button>
            <button onClick={playPrev} style={{ color: '#FFFFFF' }}>
              <SkipBack size={26} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
              style={{ background: '#FF4D3D', boxShadow: '0 4px 16px rgba(255,77,61,0.4)' }}
            >
              {isPlaying
                ? <Pause size={24} color="white" fill="white" />
                : <Play size={24} color="white" fill="white" />
              }
            </button>
            <button onClick={playNext} style={{ color: '#FFFFFF' }}>
              <SkipForward size={26} />
            </button>
            <button onClick={skipCurrent} style={{ color: '#6B6B6B' }}>
              <MoreHorizontal size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Video mode transport */}
      {settings.playbackMode === 'video' && (
        <div
          className="rounded-2xl p-4 mb-5 flex flex-col"
          style={{ background: '#0E0E0E' }}
        >
          <div className="mb-3">
            <h2 className="text-lg font-bold truncate" style={{ color: '#FFFFFF' }}>
              {track?.track || 'No track'}
            </h2>
            <p className="text-sm truncate" style={{ color: '#9A9A9A' }}>{track?.artist}</p>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={handleLike}>
              <Heart size={20} fill={isLiked ? '#FF4D3D' : 'none'} color={isLiked ? '#FF4D3D' : '#6B6B6B'} />
            </button>
            <button onClick={playPrev} style={{ color: '#FFFFFF' }}><SkipBack size={22} /></button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: '#FF4D3D' }}
            >
              {isPlaying ? <Pause size={20} color="white" fill="white" /> : <Play size={20} color="white" fill="white" />}
            </button>
            <button onClick={playNext} style={{ color: '#FFFFFF' }}><SkipForward size={22} /></button>
            <button onClick={skipCurrent} style={{ color: '#6B6B6B' }}><MoreHorizontal size={20} /></button>
          </div>
        </div>
      )}

      {/* AI Advisor section */}
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
              {isAnalyzing ? 'Analyzing...' : advisorData ? 'Refresh' : 'Analyze'}
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
                      {bubble.type === 'song' && '🎵 '}
                      {bubble.type === 'era' && '📅 '}
                      {bubble.label}: {bubble.value}
                    </Chip>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Audio player (hidden) */}
      {settings.playbackMode === 'audio' && <YTPlayer />}

      {/* Bottom spacing for nav */}
      <div className="h-24" />
    </div>
  );
}
