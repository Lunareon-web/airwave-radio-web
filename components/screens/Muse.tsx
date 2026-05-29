'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Sparkles, Play, Pause, Loader2, ListMusic, ChevronDown, ChevronUp, ListPlus, BookmarkPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { ChatMessage, CuratedTrack, MusicBubble } from '@/lib/types';

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

function TrackCard({
  track,
  onAdd,
  onPlay,
  onAddToPlaylist,
}: {
  track: CuratedTrack;
  onAdd: () => void;
  onPlay: () => void;
  onAddToPlaylist: () => void;
}) {
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
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={onPlay}
          className="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-70"
          title="Play now"
        >
          <Play size={15} color="#FF4D3D" fill="#FF4D3D" />
        </button>
        <button
          onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-70"
          title="Add to queue"
        >
          <Plus size={15} color="#C2C0BB" />
        </button>
        <button
          onClick={onAddToPlaylist}
          className="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-70"
          title="Add to playlist"
        >
          <ListMusic size={15} color="#C2C0BB" />
        </button>
      </div>
    </div>
  );
}

/** Expandable track list inside a Muse message bubble */
function MessageTrackList({
  tracks,
  onPlayAll,
  onAddAll,
  onSaveToPlaylist,
}: {
  tracks: CuratedTrack[];
  onPlayAll: () => void;
  onAddAll: () => void;
  onSaveToPlaylist: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { addToQueue, setAddToPlaylistTrack } = useAppStore();
  const visible = expanded ? tracks : tracks.slice(0, 5);

  return (
    <div className="mt-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#9A9A9A' }}>
          {tracks.length} tracks
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveToPlaylist}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,77,61,0.08)', color: '#FF4D3D' }}
            title="Save all to playlist"
          >
            <BookmarkPlus size={13} />
          </button>
          <button
            onClick={onAddAll}
            className="text-xs font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
            style={{ background: 'rgba(255,77,61,0.12)', color: '#FF4D3D' }}
            title="Add all to queue"
          >
            <ListPlus size={10} /> Add All
          </button>
          <button
            onClick={onPlayAll}
            className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{ background: '#FF4D3D', color: '#FFFFFF' }}
          >
            <Play size={10} fill="white" /> Play All
          </button>
        </div>
      </div>

      {/* Track cards */}
      {visible.map((track, i) => (
        <TrackCard
          key={i}
          track={track}
          onAdd={() => addToQueue({ ...track })}
          onPlay={() => {
            const store = useAppStore.getState();
            store.setCuratedTracks(tracks);
            store.setActiveSource('curated');
            store.setActiveIndex(expanded ? i : i);
            store.setIsPlaying(true);
            store.setActiveScreen('radio');
          }}
          onAddToPlaylist={() => setAddToPlaylistTrack(track)}
        />
      ))}

      {/* Expand / collapse toggle */}
      {tracks.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl mt-1 transition-opacity hover:opacity-70"
          style={{ background: '#1A1A1A', color: '#9A9A9A' }}
        >
          {expanded ? (
            <><ChevronUp size={12} /> Show less</>
          ) : (
            <><ChevronDown size={12} /> +{tracks.length - 5} more</>
          )}
        </button>
      )}
    </div>
  );
}

export function Muse() {
  const {
    chatMessages, addChatMessage, clearChat,
    isCurating, setIsCurating, curationError, setCurationError,
    curatedTracks, setCuratedTracks, currentPrompt, setCurrentPrompt,
    addToQueue, playNow, setActiveScreen,
    settings, setAddToPlaylistTrack, setAddToPlaylistTracks,
    // AI Advisor
    advisorData, setAdvisorData, isAnalyzing, setIsAnalyzing,
    getCurrentTrack,
    // Discography
    setDiscographyTracks, setDiscographyArtist, setDiscographyQuery,
  } = useAppStore();

  const currentTrack = getCurrentTrack();

  const [input, setInput] = useState(currentPrompt || '');
  const [isTyping, setIsTyping] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Prevents auto-curate loop when Muse itself sets currentPrompt
  const selfTrigger = useRef(false);
  // Prevents auto-curate on app open: session restore sets currentPrompt
  // within the first ~1 s, which would otherwise fire curate() and burn
  // Gemini tokens without any user interaction.
  // After 2 s the guard lifts and normal auto-curate (e.g. Start Radio) works.
  const startupGuard = useRef(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Lift the startup guard after 2 s — enough time for session restore to
  // complete (usually < 500 ms) but before any user interaction is possible.
  useEffect(() => {
    const t = setTimeout(() => { startupGuard.current = false; }, 2000);
    return () => clearTimeout(t);
  }, []);

  // ── Auto-curate when currentPrompt is set externally (e.g. Start Radio) ──
  useEffect(() => {
    if (selfTrigger.current) { selfTrigger.current = false; return; }
    if (!currentPrompt) return;
    setInput(currentPrompt);
    // During the startup window the prompt was restored from session —
    // don't auto-curate (would cost Gemini tokens on every app open).
    if (startupGuard.current) return;
    const alreadyDone = chatMessages.some(
      (m) => m.role === 'user' && m.content === currentPrompt
    );
    if (!alreadyDone) curate(currentPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrompt]);

  // ── AI Advisor ────────────────────────────────────────────────────────────
  const analyzeTrack = async () => {
    if (!currentTrack || isAnalyzing) return;
    setIsAnalyzing(true);
    setAdvisorOpen(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.geminiKey) headers['X-Gemini-Key'] = settings.geminiKey;
      const res = await fetch('/api/advisor/analyze', {
        method: 'POST', headers,
        body: JSON.stringify({ artist: currentTrack.artist, track: currentTrack.track }),
      });
      setAdvisorData(await res.json());
    } catch (e) { console.error('Advisor error:', e); }
    finally { setIsAnalyzing(false); }
  };

  const handleBubbleClick = (bubble: MusicBubble) => {
    if (bubble.type === 'artist') {
      setDiscographyTracks([]);
      setDiscographyArtist(null);
      setDiscographyQuery(bubble.value);
      setActiveScreen('library');
    } else if (bubble.type === 'song') {
      const parts = bubble.value.split(' - ');
      const artist = parts[0]?.trim() || '';
      const track  = parts.slice(1).join(' - ').trim() || bubble.value;
      playNow({ artist, track, status: 'idle' as const });
    } else {
      const prompt = advisorData?.seedPrompt || `${bubble.value} similar music`;
      selfTrigger.current = true;
      setCurrentPrompt(prompt);
      curate(prompt);
    }
  };

  const curate = async (prompt: string) => {
    if (!prompt.trim() || isCurating) return;
    const trimmed = prompt.trim();
    setInput('');
    selfTrigger.current = true;   // prevent auto-curate loop
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

  const handleAddAll = (tracks: CuratedTrack[]) => {
    tracks.forEach((t) => addToQueue({ ...t }));
  };

  // Suppress unused var warning; curationError is used implicitly via chat messages
  void curationError;

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

      {/* ── AI Music Curator panel ──────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid #DCDBD7', flexShrink: 0 }}>
        {/* Compact always-visible row */}
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,77,61,0.12)' }}
          >
            <Sparkles size={13} color="#FF4D3D" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold" style={{ color: '#131313' }}>AI Music Curator</p>
            {currentTrack
              ? <p className="text-[10px] truncate" style={{ color: '#9A9A9A' }}>{currentTrack.artist} · {currentTrack.track}</p>
              : <p className="text-[10px]" style={{ color: '#C2C0BB' }}>No track playing</p>
            }
          </div>
          <button
            onClick={analyzeTrack}
            disabled={isAnalyzing || !currentTrack}
            className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 disabled:opacity-40 transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,77,61,0.12)', color: '#FF4D3D' }}
          >
            {isAnalyzing
              ? <Loader2 size={11} className="animate-spin" />
              : advisorData ? 'Neu' : 'Analyze'}
          </button>
          {advisorData && (
            <button
              onClick={() => setAdvisorOpen((v) => !v)}
              style={{ color: '#9A9A9A', flexShrink: 0 }}
            >
              {advisorOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>

        {/* Expanded advisor data */}
        <AnimatePresence>
          {advisorData && advisorOpen && (() => {
            const byType = advisorData.bubbles.reduce<Record<string, typeof advisorData.bubbles>>(
              (acc, b) => { (acc[b.type] = acc[b.type] || []).push(b); return acc; }, {}
            );
            const SECTIONS = [
              { key: 'genre',  label: 'GENRE & STIL',        color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
              { key: 'mood',   label: 'STIMMUNG',             color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
              { key: 'artist', label: 'ÄHNLICHE KÜNSTLER',   color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
              { key: 'era',    label: 'ÄRA & BEWEGUNG',       color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
              { key: 'song',   label: 'VERWANDTE SONGS',      color: '#06B6D4', bg: 'rgba(6,182,212,0.10)' },
            ];
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-3 space-y-2.5 overflow-hidden"
              >
                {/* Track context note */}
                {advisorData && currentTrack && (
                  <p className="text-[10px] italic" style={{ color: '#C2C0BB' }}>
                    Analyse für anderen Track — oben neu starten
                  </p>
                )}

                {SECTIONS.map(({ key, label, color, bg }) => {
                  const items = byType[key];
                  if (!items?.length) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-bold tracking-wider" style={{ color: '#9A9A9A' }}>
                          {label}
                        </p>
                        {key === 'artist' && (
                          <button
                            className="text-[10px] font-semibold hover:opacity-70"
                            style={{ color: '#10B981' }}
                            onClick={() => {
                              if (items[0]) handleBubbleClick({ type: 'artist', label: 'Similar Artist', value: items[0].value });
                            }}
                          >
                            · Discography laden
                          </button>
                        )}
                        {key === 'song' && (
                          <button
                            className="text-[10px] font-semibold hover:opacity-70"
                            style={{ color: '#06B6D4' }}
                            onClick={() => {
                              if (items[0]) handleBubbleClick({ type: 'song', label: 'Similar Song', value: items[0].value });
                            }}
                          >
                            · sofort abspielen
                          </button>
                        )}
                      </div>
                      {key === 'song' ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          {items.map((bubble, i) => {
                            const parts  = bubble.value.split(' - ');
                            const sArtist = parts[0]?.trim() || '';
                            const sTrack  = parts.slice(1).join(' - ').trim() || bubble.value;
                            return (
                              <button
                                key={i}
                                onClick={() => handleBubbleClick(bubble)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95 text-left w-full"
                                style={{ background: bg }}
                              >
                                <AlbumArt artist={sArtist} track={sTrack} size={28} rounded="lg" />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-semibold" style={{ color }}>{sTrack}</p>
                                  <p className="truncate text-[10px] opacity-70" style={{ color }}>{sArtist}</p>
                                </div>
                                <Play size={11} fill={color} color={color} style={{ flexShrink: 0, opacity: 0.7 }} />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((bubble, i) => (
                            <button
                              key={i}
                              onClick={() => handleBubbleClick(bubble)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 active:scale-95"
                              style={{ background: bg, color }}
                            >
                              {key === 'artist' && '👤 '}
                              {key === 'era'    && '⏱ '}
                              {bubble.value}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Start similar radio */}
                {advisorData.seedPrompt && (
                  <button
                    onClick={() => { selfTrigger.current = true; setCurrentPrompt(advisorData!.seedPrompt!); curate(advisorData!.seedPrompt!); }}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-center transition-all hover:opacity-80 mt-1"
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
                  <MessageTrackList
                    tracks={msg.tracks}
                    onPlayAll={() => handlePlayAll(msg.tracks!)}
                    onAddAll={() => handleAddAll(msg.tracks!)}
                    onSaveToPlaylist={() => setAddToPlaylistTracks([...msg.tracks!])}
                  />
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
