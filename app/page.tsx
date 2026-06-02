'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { NowPlaying } from '@/components/screens/NowPlaying';
import { Queue } from '@/components/screens/Queue';
import { Muse } from '@/components/screens/Muse';
import { Library as LibraryScreen } from '@/components/screens/Library';
import { CardyNav } from '@/components/navigation/CardyNav';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import { AddToPlaylistModal } from '@/components/ui/AddToPlaylistModal';
import { BackgroundResolver } from '@/components/player/BackgroundResolver';
import { ytCommand } from '@/components/player/YTPlayer';
import { startSilentAudio, msAssert } from '@/lib/silentAudio';
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
  // Dedup ref: prevents the race where Chrome fires BOTH a keydown event AND a
  // Media Session action for the same media-key press. For play/pause the old
  // double-fire caused a toggle revert; for skip/prev it would skip 2 tracks.
  // Both paths stamp the same timestamp → whichever fires second is a no-op.
  const mediaSkipTimeRef = useRef({ next: 0, prev: 0 });

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

  // ── Keyboard shortcuts: Space / ← / → / MediaStop ───────────────────────
  // Media play/pause/prev/next are handled EXCLUSIVELY by the Media Session action
  // handlers registered in assertMediaSession (see below). Do NOT duplicate them
  // here: Chrome fires BOTH keydown AND the Media Session action for the same
  // key press, so a toggle in keydown would race with the action handler and
  // revert the state — producing the "brief animation then stops" bug.
  // Only MediaStop stays here because there is no standard Media Session 'stop' action.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const store = useAppStore.getState();

      if (e.code === 'MediaStop') {
        e.preventDefault();
        ytCommand.send?.('pauseVideo');
        store.setIsPlaying(false);
        return;
      }

      // ── Media track keys — deduplicated against the MS action handler ──────
      // Chrome fires BOTH keydown AND the Media Session action for the same key.
      // The timestamp guard ensures only the first arrival (within 400 ms) acts.
      if (e.code === 'MediaTrackNext') {
        e.preventDefault();
        const now = Date.now();
        if (now - mediaSkipTimeRef.current.next < 400) return;
        mediaSkipTimeRef.current.next = now;
        store.skipCurrent();
        return;
      }
      if (e.code === 'MediaTrackPrevious') {
        e.preventDefault();
        const now = Date.now();
        if (now - mediaSkipTimeRef.current.prev < 400) return;
        mediaSkipTimeRef.current.prev = now;
        store.playPrev();
        return;
      }

      // ── Standard app shortcuts ─────────────────────────────────────────────
      if (e.code === 'Space') {
        e.preventDefault();
        startSilentAudio(); // keyboard is a user gesture — secure audio focus
        msAssert.fn?.();    // register handlers synchronously while in gesture context
        store.setIsPlaying(!store.isPlaying);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const newTime = Math.min(store.currentTime + 5, store.duration);
        ytCommand.send?.('seekTo', [newTime, true]);
        store.setCurrentTime(newTime);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(store.currentTime - 5, 0);
        ytCommand.send?.('seekTo', [newTime, true]);
        store.setCurrentTime(newTime);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Media Session: register handlers + update metadata ──────────────────
  // Strategy: YouTube's iframe registers its OWN media session at several
  // points after playback starts (typically 0.3–2 s). This overrides our
  // registration, replaces metadata with YouTube's channel name, and — most
  // critically — calls setPositionState() which switches Android Chrome to
  // the "full player" notification layout (seek bar + only [⏸], no prev/next).
  //
  // Counter-strategy:
  //   1. Re-assert at 300, 800, 1500, 2500, 4000 ms after every track/state change.
  //   2. Explicitly call setPositionState() with NO args to clear the seek-bar
  //      layout that YouTube's iframe set — restoring [⏮][⏸][⏭].
  //   3. Re-assert immediately when YTPlayer fires onReady (state=1) —
  //      the most precise moment right after YouTube's own registration.
  const assertMediaSession = useCallback(() => {
    if (!('mediaSession' in navigator)) return;
    const store = useAppStore.getState();
    const track = store.getCurrentTrack();

    // Media Session action handlers are called by Chrome in a user-gesture context,
    // so ytCommand.send() here is synchronous — audio.play() is allowed by autoplay policy.
    // (In audio mode, ytCommand.send maps to audioElement.play()/pause() directly.)
    navigator.mediaSession.setActionHandler('play', () => {
      ytCommand.send?.('playVideo');                  // synchronous audio.play() ← key!
      useAppStore.getState().setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      ytCommand.send?.('pauseVideo');
      useAppStore.getState().setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const now = Date.now();
      if (now - mediaSkipTimeRef.current.next < 400) return;
      mediaSkipTimeRef.current.next = now;
      useAppStore.getState().skipCurrent();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const now = Date.now();
      if (now - mediaSkipTimeRef.current.prev < 400) return;
      mediaSkipTimeRef.current.prev = now;
      useAppStore.getState().playPrev();
    });
    // seekto attaches to seek-bar drag without consuming a button slot.
    // seekforward / seekbackward are NOT registered — they steal the [⏮][⏭] slots.
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime == null) return;
      const t = details.seekTime;
      ytCommand.send?.('seekTo', [t, true]);
      ytCommand.syncSeek?.(t);
      useAppStore.getState().setCurrentTime(t);
    });

    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   track.track,
        artist:  track.artist,
        artwork: track.coverArt ? [{ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
    navigator.mediaSession.playbackState = store.isPlaying ? 'playing' : 'paused';

    // OWN the position state with our data so Chrome uses our session as the
    // authoritative one — not the YouTube iframe's.
    // When the TOP-LEVEL PAGE calls setPositionState Chrome respects all registered
    // handlers (prev/next/seekto) alongside the seek bar.
    // When an iframe calls it, Chrome overrides us and hides prev/next.
    const { duration, currentTime } = store;
    const validDuration = isFinite(duration) && duration > 0;
    const validPosition = isFinite(currentTime) && currentTime >= 0;
    if (validDuration && validPosition) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(currentTime, duration),
        });
      } catch { /* ignore — older Chrome may throw for invalid values */ }
    } else {
      // Duration/position not yet known — clear so Chrome falls back to 3-button layout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { (navigator.mediaSession as any).setPositionState(null); } catch { /* ignore */ }
      try { navigator.mediaSession.setPositionState(); } catch { /* ignore */ }
    }
  }, []);

  // Expose assertMediaSession via module-level ref so NowPlaying can call it
  // synchronously inside play-button onClick (user-gesture context).
  useEffect(() => {
    msAssert.fn = assertMediaSession;
    return () => { msAssert.fn = null; };
  }, [assertMediaSession]);

  // Register immediately on mount (cold-start / session-restore)
  useEffect(() => { assertMediaSession(); }, [assertMediaSession]);

  // Re-assert at multiple intervals after every track / play-state change.
  // 5 checkpoints cover the full window in which YouTube re-registers its session.
  useEffect(() => {
    assertMediaSession();
    const delays = [300, 800, 1500, 2500, 4000];
    const timers = delays.map((ms) => setTimeout(assertMediaSession, ms));
    return () => timers.forEach(clearTimeout);
  }, [assertMediaSession, isPlaying, activeIndex, activeSource]);

  // Continuous re-assertion while playing.
  // YouTube's iframe calls setPositionState() every ~1 s indefinitely.
  // 300 ms interval guarantees we override it within one YouTube cycle.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(assertMediaSession, 300);
    return () => clearInterval(id);
  }, [assertMediaSession, isPlaying]);

  // onYTReady: fired by YTPlayer when playerState=1 (video actually playing).
  // YouTube's iframe re-registers its own Media Session in the ~0–800 ms
  // window after playerState=1. We re-assert at multiple checkpoints to ensure
  // we always override it — 150 ms targets the most common registration delay.
  const onYTReady = useCallback(() => {
    assertMediaSession();
    [50, 150, 300, 600, 1200].forEach((ms) => setTimeout(assertMediaSession, ms));
  }, [assertMediaSession]);

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

          {/* ── Left column: Library — flex 1 of 5.3 ── */}
          <div
            className="overflow-hidden"
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              borderRight: '1px solid #DCDBD7',
            }}
          >
            <LibraryScreen />
          </div>

          {/* ── Center column: Player (auto height) + Queue (fills rest) ── */}
          <div
            className="overflow-hidden"
            style={{
              flex: 3,
              minWidth: 0,
              display: 'grid',
              // Player always sizes to its natural content height — no scroll.
              // Queue row gets whatever remains.
              gridTemplateRows: 'auto 1fr',
            }}
          >
            {/* Player — clips content, never scrolls */}
            <div className="overflow-hidden" style={{ borderBottom: '1px solid #DCDBD7' }}>
              <NowPlaying desktopMode onYTReady={onYTReady} />
            </div>
            {/* Queue — scrollable */}
            <div className="overflow-y-auto">
              <Queue desktopMode />
            </div>
          </div>

          {/* ── Right column: Muse — flex 1.3 (+30% wider than Library) ── */}
          <div
            className="overflow-hidden"
            style={{
              flex: 1.3,
              minWidth: 0,
              overflowY: 'auto',
              borderLeft: '1px solid #DCDBD7',
            }}
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
              // visibility:hidden keeps the DOM tree alive (YTPlayer iframe keeps running,
              // postMessage events keep flowing, audio doesn't stutter) while making
              // NowPlaying invisible behind other screens.
              // display:none would throttle/freeze the iframe on Android Chrome.
              visibility:   activeScreen === 'radio' ? 'visible' : 'hidden',
              pointerEvents: activeScreen === 'radio' ? 'auto'    : 'none',
              position: 'absolute', inset: 0, zIndex: 1,
              minHeight: '100svh', background: '#F0EFEC', overflowY: 'auto',
            }}
          >
            <NowPlaying onYTReady={onYTReady} />
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

      {/* Background resolver — loads cover art for all idle tracks (3s throttle) */}
      <BackgroundResolver />
    </>
  );
}
