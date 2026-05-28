'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { NowPlaying } from '@/components/screens/NowPlaying';
import { BackgroundResolver } from '@/components/player/BackgroundResolver';
import { Queue } from '@/components/screens/Queue';
import { Muse } from '@/components/screens/Muse';
import { Library as LibraryScreen } from '@/components/screens/Library';
import { CardyNav } from '@/components/navigation/CardyNav';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import { AddToPlaylistModal } from '@/components/ui/AddToPlaylistModal';
import type { CuratedTrack, DiscographyArtist } from '@/lib/types';

const SCREEN_VARIANTS = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Reset tracks that were mid-search when the session was saved */
function resetStatus(tracks: CuratedTrack[]): CuratedTrack[] {
  return tracks.map((t) =>
    t.status === 'searching' ? { ...t, status: 'idle' as const } : t
  );
}


export default function HomePage() {
  const playbackMode = useAppStore((s) => s.settings.playbackMode);

  const {
    activeScreen,
    setLibrary,
    setSettings,
    setShowSettings,
    curatedTracks,
    discographyTracks,
    discographyArtist,
    discographyQuery,
    queue,
    playedTracks,
    skippedTracks,
    isShuffled,
    volume,
    queueTab,
    currentPrompt,
    activeIndex,
    activeSource,
    isPlaying,
  } = useAppStore();

  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load library, settings, playlists + restore session on mount ─────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [likedRes, historyRes, settingsRes, playlistsRes, sessionRes] = await Promise.all([
          fetch('/api/library/liked'),
          fetch('/api/library/history'),
          fetch('/api/settings'),
          fetch('/api/library/playlists'),
          fetch('/api/session'),
        ]);

        const store = useAppStore.getState();
        let liked     = store.library.liked;
        let history   = store.library.history;
        let playlists = store.library.playlists;

        if (likedRes.ok)     { const d = await likedRes.json();     liked     = d.liked     || []; }
        if (historyRes.ok)   { const d = await historyRes.json();   history   = d.history   || []; }
        if (playlistsRes.ok) { const d = await playlistsRes.json(); playlists = d.playlists || []; }
        setLibrary({ liked, disliked: store.library.disliked, history, playlists });

        if (settingsRes.ok) { const d = await settingsRes.json(); if (d.settings) setSettings(d.settings); }

        // Helper: apply a session snapshot (server uses snake_case, localStorage uses camelCase)
        const applySession = (saved: Record<string, unknown>, snake: boolean) => {
          const get = (camel: string, snek: string) => saved[snake ? snek : camel];
          const discTracks = get('discographyTracks', 'discography_tracks') as typeof store.discographyTracks | undefined;
          const discArtist = get('discographyArtist', 'discography_artist') as DiscographyArtist | null | undefined;
          const discQuery  = get('discographyQuery',  'discography_query')  as string | undefined;
          const curated    = get('curatedTracks',     'curated_tracks')     as typeof store.curatedTracks | undefined;
          const prompt     = get('currentPrompt',     'current_prompt')     as string | undefined;
          const q          = get('queue',             'queue')              as typeof store.queue | undefined;
          const played     = get('playedTracks',      'played_tracks')      as typeof store.playedTracks | undefined;
          const skipped    = get('skippedTracks',     'skipped_tracks')     as typeof store.skippedTracks | undefined;
          const shuffled   = get('isShuffled',        'is_shuffled')        as boolean | undefined;
          const vol        = get('volume',            'volume')             as number | undefined;
          const tab        = get('queueTab',          'queue_tab')          as typeof store.queueTab | undefined;
          if (discTracks?.length)           store.setDiscographyTracks(resetStatus(discTracks));
          if (discArtist !== undefined)     store.setDiscographyArtist(discArtist);
          if (discQuery)                    store.setDiscographyQuery(discQuery);
          if (curated?.length)              store.setCuratedTracks(resetStatus(curated));
          if (prompt)                       store.setCurrentPrompt(prompt);
          if (q?.length)                    store.setQueue(resetStatus(q));
          if (played?.length)               store.setPlayedTracks(played);
          if (skipped?.length)              store.setSkippedTracks(skipped);
          if (typeof shuffled === 'boolean') store.setIsShuffled(shuffled);
          if (typeof vol === 'number')       store.setVolume(vol);
          if (tab)                           store.setQueueTab(tab);
        };

        if (sessionRes.ok) {
          const { session: saved } = await sessionRes.json();
          if (saved) applySession(saved as Record<string, unknown>, true);
        } else {
          // Fall back to localStorage for unauthenticated users
          try {
            const raw = localStorage.getItem('airwave_session_v1');
            if (raw) {
              const saved = JSON.parse(raw) as Record<string, unknown>;
              applySession(saved, false);
            }
          } catch (e) { console.warn('localStorage restore error:', e); }
        }
      } catch (e) {
        console.error('Load data error:', e);
      }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced session save ────────────────────────────────────────────────
  useEffect(() => {
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(async () => {
      const state = useAppStore.getState();
      const payload = {
        discographyTracks: state.discographyTracks,
        discographyArtist: state.discographyArtist,
        discographyQuery:  state.discographyQuery,
        curatedTracks:     state.curatedTracks,
        currentPrompt:     state.currentPrompt,
        queue:             state.queue,
        playedTracks:      state.playedTracks,
        skippedTracks:     state.skippedTracks,
        isShuffled:        state.isShuffled,
        volume:            state.volume,
        queueTab:          state.queueTab,
        activeSource:      state.activeSource,
        activeIndex:       state.activeIndex,
      };
      // Always persist to localStorage (works for all users, including unauthenticated)
      try {
        localStorage.setItem('airwave_session_v1', JSON.stringify(payload));
      } catch (e) { console.warn('localStorage save error:', e); }
      // Also try server-side session (requires auth)
      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) { console.error('Session save error:', e); }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    curatedTracks, discographyTracks, discographyArtist, discographyQuery,
    queue, playedTracks, skippedTracks, isShuffled, volume, queueTab,
    activeIndex, activeSource, currentPrompt,
  ]);

  // ── Rolling curated append: when near end, fetch more ────────────────────
  useEffect(() => {
    const state = useAppStore.getState();
    if (
      activeSource === 'curated' &&
      curatedTracks.length > 0 &&
      activeIndex >= curatedTracks.length - 3 &&
      !state.isCurating &&
      state.currentPrompt
    ) {
      const appendMore = async () => {
        state.setIsCurating(true);
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (state.settings.geminiKey) headers['X-Gemini-Key'] = state.settings.geminiKey;
          const existing = curatedTracks.map((t) => `${t.artist} - ${t.track}`);
          const res = await fetch('/api/playlist/generate', {
            method: 'POST', headers,
            body: JSON.stringify({ prompt: state.currentPrompt, count: 5, exclude: existing }),
          });
          const data = await res.json();
          if (data.playlist?.length) state.setCuratedTracks([...curatedTracks, ...data.playlist]);
        } catch (e) { console.error('Rolling append error:', e); }
        finally { state.setIsCurating(false); }
      };
      appendMore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeSource]);

  // ── Keyboard shortcuts: Space / ← / → ────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const store = useAppStore.getState();
      if (e.code === 'Space')           { e.preventDefault(); store.setIsPlaying(!store.isPlaying); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); store.skipCurrent(); }
      else if (e.code === 'ArrowLeft')  { e.preventDefault(); store.playPrev(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Media Session API ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const store = useAppStore.getState();
    const track = store.getCurrentTrack();
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   track.track,
        artist:  track.artist,
        artwork: track.coverArt ? [{ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play',          () => useAppStore.getState().setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause',         () => useAppStore.getState().setIsPlaying(false));
    navigator.mediaSession.setActionHandler('nexttrack',     () => useAppStore.getState().skipCurrent());
    navigator.mediaSession.setActionHandler('previoustrack', () => useAppStore.getState().playPrev());
    return () => {
      (['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]).forEach((a) =>
        navigator.mediaSession.setActionHandler(a, null)
      );
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeIndex, activeSource]);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP — 3-column layout, ≥ 1024px
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col"
        style={{ height: '100vh', background: '#F0EFEC', overflow: 'hidden' }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{ height: 52, borderBottom: '1px solid #DCDBD7', background: '#F0EFEC' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#FF4D3D' }}
            >
              <Sparkles size={14} color="white" />
            </div>
            <span className="text-sm font-extrabold tracking-tight" style={{ color: '#131313' }}>
              Airwave Radio
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: '#E8E6E1', color: '#6B6B6B' }}
          >
            <Settings size={15} />
          </button>
        </div>

        {/* 3-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left column: Library (discography search + liked / history / playlists) ── */}
          <div
            className="flex-shrink-0 overflow-y-auto"
            style={{ width: 320, borderRight: '1px solid #DCDBD7' }}
          >
            <LibraryScreen />
          </div>

          {/* ── Center column: Player on top, Queue below (CSS grid split) ── */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              minWidth: 320,
              display: 'grid',
              // video: player auto-sizes to content (50vh video + controls), queue fills rest
              // audio: fixed 25/75 ratio
              gridTemplateRows: playbackMode === 'video' ? 'auto 1fr' : '25fr 75fr',
            }}
          >
            {/* Player — overflow-hidden in video mode so there is no scroll */}
            <div
              className={playbackMode === 'video' ? 'overflow-hidden' : 'overflow-y-auto'}
              style={{ borderBottom: '1px solid #DCDBD7' }}
            >
              <NowPlaying desktopMode />
            </div>
            {/* Queue */}
            <div className="overflow-y-auto">
              <Queue desktopMode />
            </div>
          </div>

          {/* ── Right column: Muse (AI curation + curated tracklist) ── */}
          <div
            className="flex-shrink-0 overflow-y-auto"
            style={{ width: 360, borderLeft: '1px solid #DCDBD7' }}
          >
            <Muse />
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE — single column with bottom nav, < 1024px
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="lg:hidden min-h-screen flex items-start justify-center"
        style={{ background: '#F0EFEC' }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ maxWidth: 430, minHeight: '100svh', background: '#F0EFEC' }}
        >
          {/*
           * NowPlaying ALWAYS MOUNTED — YTPlayer must never be unmounted.
           * Other screens render on top (z-index 2) while NowPlaying stays hidden.
           */}
          <div
            style={{
              display: activeScreen === 'radio' ? 'block' : 'none',
              position: 'absolute', inset: 0, zIndex: 1,
              minHeight: '100svh', background: '#F0EFEC', overflowY: 'auto',
            }}
          >
            <NowPlaying />
          </div>

          <AnimatePresence mode="wait">
            {activeScreen !== 'radio' && (
              <motion.div
                key={activeScreen}
                variants={SCREEN_VARIANTS}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="w-full"
                style={{ minHeight: '100svh', position: 'relative', zIndex: 2, background: '#F0EFEC' }}
              >
                {activeScreen === 'queue'   && <Queue />}
                {activeScreen === 'muse'    && <Muse />}
                {activeScreen === 'library' && <LibraryScreen />}
              </motion.div>
            )}
          </AnimatePresence>

          <CardyNav />
        </div>
      </div>

      {/* Global overlays — shown over both layouts */}
      <SettingsPanel />
      <AddToPlaylistModal />

      {/* Background resolver — eagerly fetches videoId + thumbnail for all idle tracks */}
      <BackgroundResolver />
    </>
  );
}
