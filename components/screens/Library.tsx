'use client';

import { useState, useEffect } from 'react';
import { Search, Play, Heart, HeartOff, History, Music, Disc, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { CuratedTrack, LibraryTrack } from '@/lib/types';

type LibTab = 'discography' | 'liked' | 'history';

type AnyTrack = {
  artist: string;
  track: string;
  coverArt?: string;
  album?: string;
  year?: string;
};

function LibTrackRow({
  track,
  onPlay,
  onAdd,
  onUnlike,
}: {
  track: AnyTrack;
  onPlay?: () => void;
  onAdd?: () => void;
  onUnlike?: () => void;
}) {
  const { artist, track: name, coverArt, album, year } = track;

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 group">
      <AlbumArt artist={artist} track={name} coverArt={coverArt} size={44} rounded="xl" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#131313' }}>{name}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>{artist}</p>
          {album && <Chip size="sm" variant="default">{album}</Chip>}
          {year && <span className="text-xs" style={{ color: '#C2C0BB' }}>{year}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onAdd && (
          <button
            onClick={onAdd}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: '#E8E6E1' }}
          >
            <Music size={14} color="#6B6B6B" />
          </button>
        )}
        {onPlay && (
          <button
            onClick={onPlay}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: '#FF4D3D' }}
          >
            <Play size={14} color="white" fill="white" />
          </button>
        )}
        {onUnlike && (
          <button onClick={onUnlike} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <HeartOff size={14} color="#FF4D3D" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Library() {
  const {
    discographyTracks, discographyArtist, discographyQuery,
    setDiscographyTracks, setDiscographyArtist, setDiscographyQuery,
    library, unlikeTrack,
    addToQueue, setActiveSource, setActiveIndex, setIsPlaying, setCuratedTracks,
    setActiveScreen, settings,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<LibTab>(discographyQuery ? 'discography' : 'liked');
  const [searchQuery, setSearchQuery] = useState(discographyQuery || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (discographyQuery && discographyTracks.length === 0) {
      searchDiscography(discographyQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchDiscography = async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setActiveTab('discography');
    try {
      const headers: Record<string, string> = {};
      if (settings.geminiKey) headers['X-Gemini-Key'] = settings.geminiKey;
      const res = await fetch(`/api/discography?q=${encodeURIComponent(query)}`, { headers });
      const data = await res.json();
      if (data.artist) setDiscographyArtist(data.artist);
      if (data.tracks) setDiscographyTracks(data.tracks);
      setDiscographyQuery(query);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => searchDiscography(searchQuery);

  const handlePlayDiscography = () => {
    if (!discographyTracks.length) return;
    setCuratedTracks(discographyTracks);
    setActiveSource('discography');
    setActiveIndex(0);
    setIsPlaying(true);
    setActiveScreen('radio');
  };

  // Group discography tracks by album
  const albumGroups = discographyTracks.reduce<Record<string, CuratedTrack[]>>((acc, track) => {
    const key = track.album || 'Singles';
    if (!acc[key]) acc[key] = [];
    acc[key].push(track);
    return acc;
  }, {});

  const TABS: { id: LibTab; label: string; icon: React.ReactNode }[] = [
    { id: 'discography', label: 'Discography', icon: <Disc size={14} /> },
    { id: 'liked', label: 'Liked', icon: <Heart size={14} /> },
    { id: 'history', label: 'History', icon: <History size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-extrabold mb-3" style={{ color: '#131313' }}>Library</h2>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: '#FFFFFF', border: '1.5px solid #DCDBD7' }}
        >
          <Search size={16} color="#9A9A9A" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search artist discography..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: '#131313', fontFamily: 'inherit' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setDiscographyQuery(''); }}>
              <X size={14} color="#9A9A9A" />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isLoading}
            className="px-3 py-1 rounded-full text-xs font-semibold disabled:opacity-50"
            style={{ background: '#FF4D3D', color: '#FFFFFF' }}
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
          </button>
        </div>
      </div>

      {/* Artist hero card */}
      <AnimatePresence>
        {discographyArtist && activeTab === 'discography' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-3 rounded-2xl p-4 flex items-center gap-4"
            style={{ background: '#0E0E0E' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF4D3D, #c0392b)' }}
            >
              {discographyArtist.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold truncate" style={{ color: '#FFFFFF' }}>
                {discographyArtist.name}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {discographyArtist.genre && <Chip size="sm" variant="accent">{discographyArtist.genre}</Chip>}
                {discographyArtist.period && <Chip size="sm" variant="dark">{discographyArtist.period}</Chip>}
                {discographyArtist.listeners && (
                  <span className="text-xs" style={{ color: '#9A9A9A' }}>{discographyArtist.listeners} listeners</span>
                )}
              </div>
            </div>
            <button
              onClick={handlePlayDiscography}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#FF4D3D' }}
            >
              <Play size={18} color="white" fill="white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.id ? '#0E0E0E' : '#E8E6E1',
              color: activeTab === tab.id ? '#FFFFFF' : '#6B6B6B',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'liked' && library.liked.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: 'rgba(255,77,61,0.2)', color: '#FF4D3D' }}>
                {library.liked.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Discography tab */}
        {activeTab === 'discography' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: '#FF4D3D' }} />
              </div>
            ) : discographyTracks.length === 0 ? (
              <div className="text-center py-12">
                <Disc size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>
                  Search for an artist to see their discography
                </p>
              </div>
            ) : (
              Object.entries(albumGroups).map(([album, tracks]) => (
                <div key={album} className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9A9A9A' }}>
                    {album}
                    {tracks[0]?.year && <span className="ml-2 font-normal normal-case" style={{ color: '#C2C0BB' }}>({tracks[0].year})</span>}
                  </p>
                  <div className="space-y-0.5">
                    {tracks.map((track, i) => (
                      <LibTrackRow
                        key={i}
                        track={track}
                        onPlay={() => {
                          const store = useAppStore.getState();
                          const globalIndex = discographyTracks.indexOf(track);
                          store.setActiveSource('discography');
                          store.setActiveIndex(globalIndex);
                          store.setIsPlaying(true);
                          setActiveScreen('radio');
                        }}
                        onAdd={() => addToQueue({ ...track })}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Liked tab */}
        {activeTab === 'liked' && (
          <>
            {library.liked.length === 0 ? (
              <div className="text-center py-12">
                <Heart size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>No liked tracks yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {library.liked.map((track) => (
                  <LibTrackRow
                    key={track.id}
                    track={track}
                    onPlay={() => {
                      const store = useAppStore.getState();
                      const playlist = library.liked.map((t) => ({
                        artist: t.artist,
                        track: t.track,
                        coverArt: t.coverArt,
                        videoId: t.videoId,
                        status: 'ready' as const,
                      }));
                      const idx = library.liked.findIndex((t) => t.id === track.id);
                      store.setLibraryPlaylist(playlist);
                      store.setActiveSource('library');
                      store.setActiveIndex(idx);
                      store.setIsPlaying(true);
                      setActiveScreen('radio');
                    }}
                    onAdd={() => addToQueue({ artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, status: 'ready' })}
                    onUnlike={() => unlikeTrack(track.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <>
            {library.history.length === 0 ? (
              <div className="text-center py-12">
                <History size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>No history yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {library.history.map((track) => (
                  <LibTrackRow
                    key={track.id}
                    track={track}
                    onPlay={() => {
                      addToQueue({ artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, status: 'ready' });
                    }}
                    onAdd={() => addToQueue({ artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, status: 'ready' })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-24" />
    </div>
  );
}
