'use client';

import { Radio, ListMusic, BookOpen, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import type { ActiveScreen } from '@/lib/types';

const NAV_ITEMS: { screen: ActiveScreen; icon: React.ReactNode; label: string }[] = [
  { screen: 'radio', icon: <Radio size={20} />, label: 'Radio' },
  { screen: 'queue', icon: <ListMusic size={20} />, label: 'Queue' },
  { screen: 'library', icon: <BookOpen size={20} />, label: 'Library' },
];

export function CardyNav() {
  const { activeScreen, setActiveScreen, isCurating } = useAppStore();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-center pb-safe"
      style={{ maxWidth: 430, margin: '0 auto', left: '50%', transform: 'translateX(-50%)', width: '100%' }}
    >
      <div className="w-full px-4 pb-5">
        <div
          className="flex items-center justify-between px-2 py-2 rounded-2xl"
          style={{
            background: '#FFFFFF',
            boxShadow: '0 -2px 20px rgba(14,14,14,0.10), 0 4px 24px rgba(14,14,14,0.08)',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => setActiveScreen(item.screen)}
                className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-xl transition-all"
                style={{
                  color: isActive ? '#FF4D3D' : '#9A9A9A',
                  flex: 1,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'rgba(255,77,61,0.08)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10 text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}

          {/* Muse FAB */}
          <button
            onClick={() => setActiveScreen('muse')}
            className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-xl transition-all"
            style={{
              color: activeScreen === 'muse' ? '#FFFFFF' : '#FF4D3D',
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-xl"
              animate={{
                background: activeScreen === 'muse' ? '#FF4D3D' : 'rgba(255,77,61,0.12)',
                scale: isCurating ? [1, 1.05, 1] : 1,
              }}
              transition={isCurating ? { repeat: Infinity, duration: 1 } : undefined}
            />
            <span className="relative z-10">
              <Sparkles size={20} />
            </span>
            <span className="relative z-10 text-[10px] font-semibold">Muse</span>
          </button>
        </div>
      </div>
    </div>
  );
}
