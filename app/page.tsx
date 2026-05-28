'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { NowPlaying } from '@/components/screens/NowPlaying';
import { Queue } from '@/components/screens/Queue';
import { Muse } from '@/components/screens/Muse';
import { Library } from '@/components/screens/Library';
import { CardyNav } from '@/components/navigation/CardyNav';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import { AddToPlaylistModal } from '@/components/ui/AddToPlaylistModal';
import type { CuratedTrack } from '@/lib/types';

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

        // Liked + history
        let liked = store.library.liked;
        let history = store.library.history;
        let playlists = store.library.playlists;

        if (likedRes.ok) {
          const d = await likedRes.json();
          liked = d.liked || [];
        }
        if (historyRes.ok) {
          const d = await historyRes.json();
          history = d.history || [];
        }
        if (playlistsRes.ok) {
          const d = await playlistsRes.json();
          playlists = d.playlists || [];
        }
        setLibrary({ liked, disliked: store.library.disliked, history, playlists });

        // Settings
        if (settingsRes.ok) {
          const d = await settingsRes.json();
          if (d.settings) setSettings(d.settings);
        }

        // Session restore
        if (sessionRes.ok) {
          const { session: saved } = await sessionRes.json();
          if (saved) {
            if (saved.discography_tracks?.length)
              store.setDiscographyTracks(resetStatus(saved.discography_tracks));
            if (saved.discography_artist)
              store.setDiscographyArtist(saved.discography_artist);
            if (saved.discography_query)
              store.setDiscographyQuery(saved.discography_query);
            if (saved.curated_tracks?.length)
              store.setCuratedTracks(resetStatus(saved.curated_tracks));
            if (saved.current_prompt)
              store.setCurrentPrompt(saved.current_prompt);
            if (saved.queue?.length)
              store.setQueue(resetStatus(saved.queue));
            if (saved.played_tracks?.length)
              store.setPlayedTracks(saved.played_tracks);
            if (saved.skipped_tracks?.length)
              store.setSkippedTracks(saved.skipped_tracks);
            if (typeof saved.is_shuffled === 'boolean')
              store.setIsShuffled(saved.is_shuffled);
            if (typeof saved.volume === 'number')
              store.setVolume(saved.volume);
            if (saved.queue_tab)
              store.setQueueTab(saved.queue_tab);
            // Note: activeSource/activeIndex/isPlaying NOT restored — user must press play
          }
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
      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discographyTracks:  state.discographyTracks,
            discographyArtist:  state.discographyArtist,
            discographyQuery:   state.discographyQuery,
            curatedTracks:      state.curatedTracks,
            currentPrompt:      state.currentPrompt,
            queue:              state.queue,
            playedTracks:       state.playedTracks,
            skippedTracks:      state.skippedTracks,
            isShuffled:         state.isShuffled,
            volume:             state.volume,
            queueTab:           state.queueTab,
            activeSource:       state.activeSource,
            activeIndex:        state.activeIndex,
          }),
        });
      } catch (e) {
        console.error('Session save error:', e);
      }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    curatedTracks, discographyTracks, discographyArtist, discographyQuery,
    queue, playedTracks, skippedTracks, isShuffled, volume, queueTab,
    activeIndex, activeSource, currentPrompt,
  ]);

  // ── Rolling curated append: when near end, fetch more ───────────────────
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
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt: state.currentPrompt, count: 5, exclude: existing }),
          });
          const data = await res.json();
          if (data.playlist?.length) {
            state.setCuratedTracks([...curatedTracks, ...data.playlist]);
          }
        } catch (e) {
          console.error('Rolling append error:', e);
        } finally {
          state.setIsCurating(false);
        }
      };
      appendMore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeSource]);

  // ── Keyboard shortcuts: Space = play/pause, ← = prev, → = skip ─────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const store = useAppStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        store.setIsPlaying(!store.isPlaying);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        store.skipCurrent();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        store.playPrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Media Session API — OS media keys & lock screen controls ─────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const store = useAppStore.getState();
    const track = store.getCurrentTrack();

    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   track.track,
        artist:  track.artist,
        artwork: track.coverArt
          ? [{ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }]
          : [],
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
      <div
        className="min-h-screen flex items-start justify-center"
        style={{ background: '#F0EFEC' }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            maxWidth: 430,
            minHeight: '100svh',
            background: '#F0EFEC',
          }}
        >
          {/*
           * NowPlaying is ALWAYS MOUNTED so that YTPlayer (inside it) is never
           * destroyed when the user navigates away. Destroying the iframe would
           * kill audio playback and reset track-resolution state.
           * We hide it with CSS when on another screen; other screens render on top.
           */}
          <div
            style={{
              display: activeScreen === 'radio' ? 'block' : 'none',
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              minHeight: '100svh',
              background: '#F0EFEC',
              overflowY: 'auto',
            }}
          >
            <NowPlaying />
          </div>

          {/* Queue / Muse / Library animate in/out on top of NowPlaying */}
          <AnimatePresence mode="wait">
            {activeScreen !== 'radio' && (
              <motion.div
                key={activeScreen}
                variants={SCREEN_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="w-full"
                style={{
                  minHeight: '100svh',
                  position: 'relative',
                  zIndex: 2,
                  background: '#F0EFEC',
                }}
              >
                {activeScreen === 'queue'   && <Queue />}
                {activeScreen === 'muse'    && <Muse />}
                {activeScreen === 'library' && <Library />}
              </motion.div>
            )}
          </AnimatePresence>

          <CardyNav />
          <SettingsPanel />

          {/* Global Add-to-Playlist modal */}
          <AddToPlaylistModal />
        </div>
      </div>
    </>
  );
}
