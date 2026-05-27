'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Sparkles, Play, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { ChatMessage, CuratedTrack } from '@/lib/types';

const QUICK_CHIPS = [
  'Chill Sunday morning',
  'Late night coding',
  'Energy for workout',
  'Rainy day jazz',
  '90s hip-hop classics',
  'Electronic focus',
  'Acoustic folk vibes',
  'Indie discovery',
];

let msgId = 0;
function newMsgId() { return `msg-${++msgId}-${Date.now()}`; }

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FF4D3D' }}
      >
        <Sparkles size={14} color="white" />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(14,14,14,0.06)' }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 0.2, 0.4].map((delay) => (
            <div
              key={delay}
              className="w-2 h-2 rounded-full"
              style={{
                background: '#C2C0BB',
                animationName: 'typingDot',
                animationDuration: '1.2s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackCard({ track, onAdd, onPlay }: { track: CuratedTrack; onAdd: () => void; onPlay: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl mb-2"
      style={{ background: '#0E0E0E' }}
    >
      <AlbumArt artist={track.artist} track={track.track} coverArt={track.coverArt} size={40} rounded="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{track.track}</p>
        <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>{track.artist}</p>
      </div>
      <button
        onClick={onPlay}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FF4D3D' }}
      >
        <Play size={14} color="white" fill="white" />
      </button>
      <button onClick={onAdd} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#E8E6E1' }}>
        <Plus size={14} color="#6B6B6B" />
      </button>
    </div>
  );
}

export function Muse() {
  const {
    chatMessages, addChatMessage, clearChat,
    isCurating, setIsCurating, curationError, setCurationError,
    curatedTracks, setCuratedTracks, currentPrompt, setCurrentPrompt,
    addToQueue, playTrack, setActiveSource, setActiveIndex, setIsPlaying,
    settings,
  } = useAppStore();

  const [input, setInput] = useState(currentPrompt || '');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const curate = async (prompt: string) => {
    if (!prompt.trim() || isCurating) return;
    const trimmed = prompt.trim();
    setInput('');
    setCurrentPrompt(trimmed);

    addChatMessage({ id: newMsgId(), role: 'user', content: trimmed, timestamp: Date.now() });
    setIsTyping(true);
    setIsCurating(true);
    setCurationError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.geminiKey) headers['X-Gemini-Key'] = settings.geminiKey;

      const existingTitles = curatedTracks.map((t) => `${t.artist} - ${t.track}`);
      const res = await fetch('/api/playlist/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: trimmed, count: 20, exclude: existingTitles.slice(0, 10) }),
      });
      const data = await res.json();

      if (!res.ok || !data.playlist) {
        throw new Error(data.error || 'Curation failed');
      }

      const tracks: CuratedTrack[] = data.playlist;
      setCuratedTracks(tracks);

      setIsTyping(false);
      addChatMessage({
        id: newMsgId(),
        role: 'muse',
        content: `Here are ${tracks.length} tracks curated for "${trimmed}" ✨`,
        tracks,
        timestamp: Date.now(),
      });
    } catch (err) {
      setIsTyping(false);
      const errMsg = err instanceof Error ? err.message : 'Something went wrong';
      setCurationError(errMsg);
      addChatMessage({
        id: newMsgId(),
        role: 'muse',
        content: `Sorry, I couldn't curate that: ${errMsg}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsCurating(false);
    }
  };

  const handlePlayAll = (tracks: CuratedTrack[]) => {
    const store = useAppStore.getState();
    store.setCuratedTracks(tracks);
    store.setActiveSource('curated');
    store.setActiveIndex(0);
    store.setIsPlaying(true);
    store.setActiveScreen('radio');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid #DCDBD7' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#FF4D3D' }}
        >
          <Sparkles size={18} color="white" />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: '#131313' }}>Muse</h2>
          <p className="text-xs" style={{ color: isCurating ? '#FF4D3D' : '#9A9A9A' }}>
            {isCurating ? 'Curating your playlist...' : 'AI Music Curator'}
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="ml-auto text-xs px-3 py-1.5 rounded-full"
            style={{ background: '#E8E6E1', color: '#6B6B6B' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {chatMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ background: 'rgba(255,77,61,0.12)' }}>
              <Sparkles size={28} color="#FF4D3D" />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: '#131313' }}>What&apos;s the vibe?</h3>
            <p className="text-sm" style={{ color: '#9A9A9A' }}>
              Describe a mood, genre, era, or artist and I&apos;ll build a playlist for you.
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end gap-2'}`}
            >
              {msg.role === 'muse' && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FF4D3D' }}
                >
                  <Sparkles size={13} color="white" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={{
                    background: msg.role === 'user' ? '#FF4D3D' : '#FFFFFF',
                    color: msg.role === 'user' ? '#FFFFFF' : '#131313',
                    boxShadow: msg.role === 'muse' ? '0 2px 8px rgba(14,14,14,0.06)' : undefined,
                  }}
                >
                  {msg.content}
                </div>
                {msg.tracks && msg.tracks.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: '#9A9A9A' }}>
                        {msg.tracks.length} tracks
                      </span>
                      <button
                        onClick={() => handlePlayAll(msg.tracks!)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                        style={{ background: '#FF4D3D', color: '#FFFFFF' }}
                      >
                        <Play size={10} fill="white" /> Play All
                      </button>
                    </div>
                    {msg.tracks.slice(0, 5).map((track, i) => (
                      <TrackCard
                        key={i}
                        track={track}
                        onAdd={() => addToQueue({ ...track })}
                        onPlay={() => {
                          const store = useAppStore.getState();
                          store.setCuratedTracks(msg.tracks!);
                          store.setActiveSource('curated');
                          store.setActiveIndex(i);
                          store.setIsPlaying(true);
                          store.setActiveScreen('radio');
                        }}
                      />
                    ))}
                    {msg.tracks.length > 5 && (
                      <p className="text-xs text-center mt-1" style={{ color: '#9A9A9A' }}>
                        +{msg.tracks.length - 5} more tracks
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
        <div className="h-4" />
      </div>

      {/* Quick chips */}
      {chatMessages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_CHIPS.map((chip) => (
              <Chip
                key={chip}
                variant="ghost"
                onClick={() => curate(chip)}
                className="flex-shrink-0"
              >
                {chip}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #DCDBD7' }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(14,14,14,0.08)' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') curate(input); }}
            placeholder="Describe a vibe..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: '#131313', fontFamily: 'inherit' }}
            disabled={isCurating}
          />
          <button
            onClick={() => curate(input)}
            disabled={!input.trim() || isCurating}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{ background: '#FF4D3D' }}
          >
            {isCurating ? (
              <Loader2 size={16} color="white" className="animate-spin" />
            ) : (
              <Send size={16} color="white" />
            )}
          </button>
        </div>
      </div>

      <div className="h-20" />

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
