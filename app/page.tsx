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

const SCREEN_VARIANTS = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function HomePage() {
  const { activeScreen, setLibrary, setSettings, curatedTracks, activeIndex, activeSource } = useAppStore();
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load library and settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [likedRes, historyRes, settingsRes] = await Promise.all([
          fetch('/api/library/liked'),
          fetch('/api/library/history'),
          fetch('/api/settings'),
        ]);
        if (likedRes.ok) {
          const { liked } = await likedRes.json();
          useAppStore.getState().setLibrary({ ...useAppStore.getState().library, liked: liked || [] });
        }
        if (historyRes.ok) {
          const { history } = await historyRes.json();
          useAppStore.getState().setLibrary({ ...useAppStore.getState().library, history: history || [] });
        }
        if (settingsRes.ok) {
          const { settings } = await settingsRes.json();
          if (settings) useAppStore.getState().setSettings(settings);
        }
      } catch (e) {
        console.error('Load data error:', e);
      }
    };
    loadData();
  }, []);

  // Debounced session save
  useEffect(() => {
    const state = useAppStore.getState();
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discographyTracks: state.discographyTracks,
            discographyArtist: state.discographyArtist,
            discographyQuery: state.discographyQuery,
            curatedTracks: state.curatedTracks,
            currentPrompt: state.currentPrompt,
            queue: state.queue,
            playedTracks: state.playedTracks,
            skippedTracks: state.skippedTracks,
            isShuffled: state.isShuffled,
            volume: state.volume,
            queueTab: state.queueTab,
            activeSource: state.activeSource,
            activeIndex: state.activeIndex,
          }),
        });
      } catch (e) {
        console.error('Session save error:', e);
      }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedTracks, activeIndex, activeSource]);

  // Rolling curated append: when near end of curated list, fetch more
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

  const screens = {
    radio: <NowPlaying />,
    queue: <Queue />,
    muse: <Muse />,
    library: <Library />,
  };

  return (
    <>
      {/* Desktop phone frame centering */}
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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              variants={SCREEN_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full"
              style={{ minHeight: '100svh' }}
            >
              {screens[activeScreen]}
            </motion.div>
          </AnimatePresence>

          <CardyNav />
          <SettingsPanel />
        </div>
      </div>
    </>
  );
}
