'use client';

import { X, ListMusic, FolderPlus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export function AddToPlaylistModal() {
  const {
    addToPlaylistTrack, setAddToPlaylistTrack,
    library, addToPlaylist, createPlaylist, setActiveScreen,
  } = useAppStore();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [added, setAdded] = useState<string | null>(null); // playlistId just added to

  if (!addToPlaylistTrack) return null;
  const track = addToPlaylistTrack;

  const handleAdd = (playlistId: string) => {
    addToPlaylist(playlistId, track);
    setAdded(playlistId);
    setTimeout(() => {
      setAdded(null);
      setAddToPlaylistTrack(null);
    }, 800);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    await createPlaylist(name);
    setCreating(false);
    setNewName('');
    // auto-close after creation
    setTimeout(() => setAddToPlaylistTrack(null), 400);
  };

  return (
    <AnimatePresence>
      {addToPlaylistTrack && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setAddToPlaylistTrack(null)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl px-5 pt-5 pb-8"
            style={{ background: '#FFFFFF', maxWidth: 430, margin: '0 auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold" style={{ color: '#131313' }}>Add to Playlist</h3>
                <p className="text-xs truncate mt-0.5" style={{ color: '#9A9A9A' }}>
                  {track.track} · {track.artist}
                </p>
              </div>
              <button onClick={() => setAddToPlaylistTrack(null)} style={{ color: '#9A9A9A' }} className="ml-3 flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* New playlist input */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="New playlist name…"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#F0EFEC', color: '#131313', border: '1.5px solid #DCDBD7' }}
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 disabled:opacity-40"
                style={{ background: '#FF4D3D', color: '#FFFFFF' }}
              >
                <FolderPlus size={14} />
                {creating ? '…' : 'New'}
              </button>
            </div>

            {/* Playlist list */}
            {library.playlists.length === 0 ? (
              <div className="text-center py-6">
                <ListMusic size={32} className="mx-auto mb-2" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>
                  Create a playlist above, or visit{' '}
                  <button
                    onClick={() => { setAddToPlaylistTrack(null); setActiveScreen('library'); }}
                    className="font-semibold underline"
                    style={{ color: '#FF4D3D' }}
                  >
                    Library
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {library.playlists.map((pl) => {
                  const isAdded = added === pl.id;
                  const alreadyIn = pl.tracks.some((t) => t.id === `${track.artist}__${track.track}`.toLowerCase().replace(/\s+/g, '_'));
                  return (
                    <button
                      key={pl.id}
                      onClick={() => !alreadyIn && handleAdd(pl.id)}
                      disabled={alreadyIn}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                      style={{
                        background: isAdded ? 'rgba(255,77,61,0.08)' : '#F0EFEC',
                        opacity: alreadyIn ? 0.5 : 1,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: '#E8E6E1' }}
                      >
                        {pl.coverArt
                          ? <img src={pl.coverArt} className="w-full h-full object-cover" alt="" />
                          : <ListMusic size={18} color="#6B6B6B" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#131313' }}>{pl.name}</p>
                        <p className="text-xs" style={{ color: '#9A9A9A' }}>
                          {pl.tracks.length} track{pl.tracks.length !== 1 ? 's' : ''}
                          {alreadyIn ? ' · Already added' : ''}
                        </p>
                      </div>
                      {isAdded && <Check size={16} color="#FF4D3D" />}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
