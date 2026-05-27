'use client';

import { useState } from 'react';
import { X, Key, Tv, Headphones, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

export function SettingsPanel() {
  const { showSettings, setShowSettings, settings, setSettings } = useAppStore();
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey || '');
  const [youtubeKey, setYoutubeKey] = useState(settings.youtubeKey || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated = {
      ...settings,
      geminiKey: geminiKey || undefined,
      youtubeKey: youtubeKey || undefined,
    };
    setSettings(updated);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
    setShowSettings(false);
  };

  return (
    <AnimatePresence>
      {showSettings && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowSettings(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
            style={{ background: '#FFFFFF', maxWidth: 430, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: '#131313' }}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ color: '#9A9A9A' }}>
                <X size={20} />
              </button>
            </div>

            {/* Playback Mode */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9A9A9A' }}>
                Playback Mode
              </h3>
              <div className="flex gap-3">
                {(['audio', 'video'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSettings({ playbackMode: mode })}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{
                      background: settings.playbackMode === mode ? '#FF4D3D' : '#F0EFEC',
                      color: settings.playbackMode === mode ? '#FFFFFF' : '#6B6B6B',
                    }}
                  >
                    {mode === 'audio' ? <Headphones size={16} /> : <Tv size={16} />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </section>

            {/* API Keys */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9A9A9A' }}>
                API Keys
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: '#6B6B6B' }}>
                    <Key size={12} /> Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#F0EFEC', color: '#131313', border: '1.5px solid #DCDBD7' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: '#6B6B6B' }}>
                    <Key size={12} /> YouTube API Key
                  </label>
                  <input
                    type="password"
                    value={youtubeKey}
                    onChange={(e) => setYoutubeKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#F0EFEC', color: '#131313', border: '1.5px solid #DCDBD7' }}
                  />
                </div>
              </div>
            </section>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white mb-3 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#FF4D3D' }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{ background: '#F0EFEC', color: '#6B6B6B' }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
