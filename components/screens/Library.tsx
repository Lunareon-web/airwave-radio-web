'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Play, Pause, Heart, HeartOff, History, Music, Disc, Loader2, X,
  ListMusic, FolderPlus, Trash2, Plus, ArrowUpDown, ChevronDown, ChevronUp,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { CuratedTrack, LibraryTrack } from '@/lib/types';

type LibTab = 'discography' | 'liked' | 'history' | 'playlists';
type SortBy  = 'default' | 'year_asc' | 'year_desc' | 'title';

// ─── LibTrackRow ─────────────────────────────────────────────────────────────

function LibTrackRow({
  track,
  onPlay,
  onAdd,
  onUnlike,
  onAddToPlaylist,
  onStartRadio,
  isActive = false,
  isPlaying = false,
}: {
  track: { artist: string; track: string; coverArt?: string; album?: string; year?: string };
  onPlay?: () => void;
  onAdd?: () => void;
  onUnlike?: () => void;
  onAddToPlaylist?: () => void;
  onStartRadio?: () => void;
  isActive?: boolean;
  isPlaying?: boolean;
}) {
  const { artist, track: name, coverArt, album, year } = track;
  const store = useAppStore.getState;
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-1 group rounded-xl transition-all"
      style={{ background: isActive ? 'rgba(255,77,61,0.06)' : 'transparent' }}
    >
      <AlbumArt artist={artist} track={name} coverArt={coverArt} size={44} rounded="xl" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#131313' }}>{name}</p>
        <div className="flex items-center gap-2">
          {/* Artist name: click to trigger discography search */}
          <button
            className="text-xs truncate text-left hover:underline transition-opacity hover:opacity-70"
            style={{ color: '#9A9A9A', maxWidth: '120px' }}
            title={`Search ${artist} discography`}
            onClick={() => {
              const s = store();
              s.setDiscographyTracks([]);
              s.setDiscographyArtist(null);
              s.setDiscographyQuery(artist);
            }}
          >
            {artist}
          </button>
          {album && <Chip size="sm" variant="default">{album}</Chip>}
          {year && <span className="text-xs" style={{ color: '#C2C0BB' }}>{year}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onStartRadio && (
          <button onClick={onStartRadio} title="Start Radio" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <Sparkles size={13} color="#6B6B6B" />
          </button>
        )}
        {onAddToPlaylist && (
          <button onClick={onAddToPlaylist} title="Add to Playlist" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <ListMusic size={13} color="#6B6B6B" />
          </button>
        )}
        {onAdd && (
          <button onClick={onAdd} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <Plus size={13} color="#6B6B6B" />
          </button>
        )}
        {onPlay && (
          <button onClick={onPlay} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: isActive && isPlaying ? '#FF4D3D' : '#E8E6E1' }}>
            {isActive && isPlaying
              ? <Pause size={13} color="white"   fill="white" />
              : <Play  size={13} color="#6B6B6B" fill="#6B6B6B" />}
          </button>
        )}
        {onUnlike && (
          <button onClick={onUnlike} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <HeartOff size={13} color="#FF4D3D" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PlaylistCard ─────────────────────────────────────────────────────────────

function PlaylistCard({
  playlist,
  onPlayAll,
  onAddAllToQueue,
  onDelete,
  onPlayTrack,
  onAddTrack,
  onRemoveTrack,
  onAddToPlaylist,
}: {
  playlist: { id: string; name: string; coverArt?: string; tracks: LibraryTrack[] };
  onPlayAll: () => void;
  onAddAllToQueue: () => void;
  onDelete: () => void;
  onPlayTrack: (t: LibraryTrack) => void;
  onAddTrack: (t: LibraryTrack) => void;
  onRemoveTrack: (trackId: string) => void;
  onAddToPlaylist: (t: LibraryTrack) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden mb-2" style={{ background: '#FFFFFF', border: '1px solid #DCDBD7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: '#E8E6E1' }}>
            {playlist.coverArt
              ? <img src={playlist.coverArt} className="w-full h-full object-cover" alt="" />
              : <ListMusic size={20} color="#6B6B6B" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate" style={{ color: '#131313' }}>{playlist.name}</p>
            <p className="text-xs" style={{ color: '#9A9A9A' }}>{playlist.tracks.length} tracks</p>
          </div>
          {expanded ? <ChevronUp size={16} color="#9A9A9A" /> : <ChevronDown size={16} color="#9A9A9A" />}
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onAddAllToQueue} disabled={!playlist.tracks.length} title="Add all to Queue"
            className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ background: '#E8E6E1' }}>
            <Plus size={13} color="#6B6B6B" />
          </button>
          <button onClick={onPlayAll} disabled={!playlist.tracks.length} title="Play all"
            className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ background: '#FF4D3D' }}>
            <Play size={13} color="white" fill="white" />
          </button>
          <button onClick={onDelete} title="Delete playlist"
            className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
            <Trash2 size={13} color="#9A9A9A" />
          </button>
        </div>
      </div>

      {/* Expanded track list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F0EFEC' }}>
          {playlist.tracks.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#9A9A9A' }}>
              Empty — add liked tracks below
            </p>
          ) : (
            playlist.tracks.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 group">
                <AlbumArt artist={t.artist} track={t.track} coverArt={t.coverArt} size={36} rounded="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#131313' }}>{t.track}</p>
                  <p className="text-[11px] truncate" style={{ color: '#9A9A9A' }}>{t.artist}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onAddTrack(t)} title="Add to Queue"
                    className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
                    <Plus size={11} color="#6B6B6B" />
                  </button>
                  <button onClick={() => onPlayTrack(t)} title="Play now"
                    className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#FF4D3D' }}>
                    <Play size={11} color="white" fill="white" />
                  </button>
                  <button onClick={() => onAddToPlaylist(t)} title="Add to another playlist"
                    className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
                    <ListMusic size={11} color="#6B6B6B" />
                  </button>
                  <button onClick={() => onRemoveTrack(t.id)} title="Remove"
                    className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#E8E6E1' }}>
                    <X size={11} color="#9A9A9A" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Library Screen ─────────────────────────────────────────────────────

export function Library() {
  const {
    discographyTracks, discographyArtist, discographyQuery,
    setDiscographyTracks, setDiscographyArtist, setDiscographyQuery,
    library, unlikeTrack, removeFromPlaylist,
    addToQueue, setActiveSource, setActiveIndex, setIsPlaying,
    setLibraryPlaylist, setActiveScreen, settings,
    playNow, createPlaylist, deletePlaylist,
    setAddToPlaylistTrack, setCurrentPrompt,
    activeSource, activeIndex, isPlaying,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<LibTab>(discographyQuery ? 'discography' : 'liked');
  const [searchQuery, setSearchQuery] = useState(discographyQuery || '');
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [filterQuery, setFilterQuery] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Auto-search on mount or whenever discographyQuery changes (e.g. artist-name click in NowPlaying)
  useEffect(() => {
    if (discographyQuery) {
      setSearchQuery(discographyQuery);
      setActiveTab('discography');
      // Only re-fetch if the query actually changed (tracks may already be loaded)
      if (discographyTracks.length === 0 || discographyArtist?.name?.toLowerCase() !== discographyQuery.toLowerCase()) {
        searchDiscography(discographyQuery);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discographyQuery]);

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
      setSortBy('default');
      setFilterQuery('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => searchDiscography(searchQuery);

  // ── Derived: sorted + filtered discography ────────────────────────────────
  const sortedFiltered = useMemo(() => {
    let result = discographyTracks.map((t, i) => ({ track: t, originalIndex: i }));
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter(({ track: t }) =>
        t.track.toLowerCase().includes(q) ||
        (t.album?.toLowerCase().includes(q) ?? false) ||
        (t.year?.includes(q) ?? false)
      );
    }
    if (sortBy === 'title')
      result = [...result].sort((a, b) => a.track.track.localeCompare(b.track.track));
    if (sortBy === 'year_asc')
      result = [...result].sort((a, b) => (a.track.year ?? '9999').localeCompare(b.track.year ?? '9999'));
    if (sortBy === 'year_desc')
      result = [...result].sort((a, b) => (b.track.year ?? '0000').localeCompare(a.track.year ?? '0000'));
    return result;
  }, [discographyTracks, filterQuery, sortBy]);

  // ── Album groups for discography ──────────────────────────────────────────
  const albumGroups = useMemo(() => {
    const map = new Map<string, { album: string; year: string; tracks: { track: CuratedTrack; originalIndex: number }[] }>();
    sortedFiltered.forEach(({ track: t, originalIndex }) => {
      const key = t.album ?? 'Singles';
      if (!map.has(key)) map.set(key, { album: key, year: t.year ?? '', tracks: [] });
      map.get(key)!.tracks.push({ track: t, originalIndex });
    });
    return [...map.values()];
  }, [sortedFiltered]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const playLibraryTrack = (tracks: LibraryTrack[], index: number) => {
    const playable = tracks.map((t) => ({
      artist: t.artist, track: t.track, coverArt: t.coverArt,
      videoId: t.videoId, status: 'idle' as const,
    }));
    setLibraryPlaylist(playable);
    setActiveSource('library');
    setActiveIndex(index);
    setIsPlaying(true);
    setActiveScreen('radio');
  };

  const toPlayable = (t: LibraryTrack): CuratedTrack => ({
    artist: t.artist, track: t.track, coverArt: t.coverArt,
    videoId: t.videoId, status: 'idle' as const,
  });

  const handlePlayDiscography = (index: number) => {
    setActiveSource('discography');
    setActiveIndex(index);
    setIsPlaying(true);
    setActiveScreen('radio');
  };

  const handleStartRadio = (artist: string, track: string) => {
    setCurrentPrompt(`${artist} ${track} similar tracks radio`);
    setActiveScreen('muse');
  };

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setCreatingPlaylist(true);
    await createPlaylist(name);
    setCreatingPlaylist(false);
    setNewPlaylistName('');
    setShowNewPlaylist(false);
  };

  const TABS: { id: LibTab; label: string; count?: number }[] = [
    { id: 'discography', label: 'Discography' },
    { id: 'liked',    label: 'Liked',    count: library.liked.length },
    { id: 'history',  label: 'History',  count: library.history.length },
    { id: 'playlists', label: 'Playlists', count: library.playlists.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-extrabold mb-3" style={{ color: '#131313' }}>Library</h2>

        {/* Discography search */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#FFFFFF', border: '1.5px solid #DCDBD7' }}>
          <Search size={16} color="#9A9A9A" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search artist discography…"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: '#131313', fontFamily: 'inherit' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setDiscographyQuery(''); setDiscographyTracks([]); setDiscographyArtist(null); }}>
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
              <p className="text-base font-extrabold truncate" style={{ color: '#FFFFFF' }}>{discographyArtist.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {discographyArtist.genre && <Chip size="sm" variant="accent">{discographyArtist.genre}</Chip>}
                {discographyArtist.period && <Chip size="sm" variant="dark">{discographyArtist.period}</Chip>}
                {discographyArtist.origin && (
                  <span className="text-xs" style={{ color: '#9A9A9A' }}>{discographyArtist.origin}</span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: '#6B6B6B' }}>
                {discographyTracks.length} tracks
                {discographyArtist.albums ? ` · ${discographyArtist.albums} albums` : ''}
              </p>
            </div>
            <button onClick={() => handlePlayDiscography(0)} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FF4D3D' }}>
              <Play size={18} color="white" fill="white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all flex-shrink-0"
            style={{
              background: activeTab === tab.id ? '#0E0E0E' : '#E8E6E1',
              color:      activeTab === tab.id ? '#FFFFFF' : '#6B6B6B',
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                style={{
                  background: activeTab === tab.id ? 'rgba(255,77,61,0.3)' : 'rgba(0,0,0,0.08)',
                  color:      activeTab === tab.id ? '#FF9990' : '#9A9A9A',
                }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">

        {/* ── Discography tab ── */}
        {activeTab === 'discography' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: '#FF4D3D' }} />
              </div>
            ) : discographyTracks.length === 0 ? (
              <div className="text-center py-12">
                <Disc size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>Search for an artist above</p>
              </div>
            ) : (
              <>
                {/* Sort + filter controls */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#E8E6E1' }}>
                    <button
                      onClick={() => setSortBy((s) => s === 'title' ? 'default' : 'title')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: sortBy === 'title' ? '#0E0E0E' : 'transparent', color: sortBy === 'title' ? '#FFFFFF' : '#6B6B6B' }}
                    >
                      <ArrowUpDown size={10} /> A
                    </button>
                    <button
                      onClick={() => setSortBy((s) => s === 'year_asc' ? 'year_desc' : 'year_asc')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: (sortBy === 'year_asc' || sortBy === 'year_desc') ? '#0E0E0E' : 'transparent', color: (sortBy === 'year_asc' || sortBy === 'year_desc') ? '#FFFFFF' : '#6B6B6B' }}
                    >
                      <ArrowUpDown size={10} /> {sortBy === 'year_desc' ? '↓' : '↑'}Y
                    </button>
                  </div>
                  {discographyTracks.length > 10 && (
                    <div className="flex-1 relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#C2C0BB' }} />
                      <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filter…"
                        className="w-full pl-7 pr-7 py-1.5 rounded-xl text-xs outline-none"
                        style={{ background: '#FFFFFF', border: '1.5px solid #DCDBD7', color: '#131313' }}
                      />
                      {filterQuery && (
                        <button onClick={() => setFilterQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                          <X size={10} color="#9A9A9A" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Album groups */}
                {albumGroups.map((group) => (
                  <div key={group.album} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>
                        {group.album}
                      </p>
                      {group.year && (
                        <span className="text-xs font-normal normal-case" style={{ color: '#C2C0BB' }}>
                          ({group.year})
                        </span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: '#C2C0BB' }}>
                        {group.tracks.length} tracks
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.tracks.map(({ track, originalIndex }) => (
                        <LibTrackRow
                          key={originalIndex}
                          track={track}
                          onPlay={() => handlePlayDiscography(originalIndex)}
                          onAdd={() => addToQueue({ ...track })}
                          onStartRadio={() => handleStartRadio(track.artist, track.track)}
                          onAddToPlaylist={() => setAddToPlaylistTrack(track)}
                          isActive={activeSource === 'discography' && activeIndex === originalIndex}
                          isPlaying={isPlaying && activeSource === 'discography' && activeIndex === originalIndex}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {filterQuery && albumGroups.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>
                    No results for &quot;{filterQuery}&quot;
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ── Liked tab ── */}
        {activeTab === 'liked' && (
          <>
            {library.liked.length === 0 ? (
              <div className="text-center py-12">
                <Heart size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>No liked tracks yet</p>
              </div>
            ) : (
              <>
                {/* Actions toolbar */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs flex-1" style={{ color: '#9A9A9A' }}>
                    {library.liked.length} tracks
                  </span>
                  <button
                    onClick={() => {
                      library.liked.forEach((t) => addToQueue(toPlayable(t)));
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: '#E8E6E1', color: '#6B6B6B' }}
                  >
                    <Plus size={11} /> Add all
                  </button>
                  <button
                    onClick={() => playLibraryTrack(library.liked, 0)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: '#FF4D3D', color: '#FFFFFF' }}
                  >
                    <Play size={11} fill="white" /> Play all
                  </button>
                </div>
                <div className="space-y-0.5">
                  {library.liked.map((track, idx) => (
                    <LibTrackRow
                      key={track.id}
                      track={track}
                      onPlay={() => playLibraryTrack(library.liked, idx)}
                      onAdd={() => addToQueue(toPlayable(track))}
                      onUnlike={() => unlikeTrack(track.id)}
                      onAddToPlaylist={() => setAddToPlaylistTrack(toPlayable(track))}
                      onStartRadio={() => handleStartRadio(track.artist, track.track)}
                      isActive={activeSource === 'library' && activeIndex === idx}
                      isPlaying={isPlaying && activeSource === 'library' && activeIndex === idx}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && (
          <>
            {library.history.length === 0 ? (
              <div className="text-center py-12">
                <History size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>No history yet</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs" style={{ color: '#9A9A9A' }}>{library.history.length} tracks</span>
                  <button
                    onClick={() => library.history.forEach((t) => addToQueue(toPlayable(t)))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: '#E8E6E1', color: '#6B6B6B' }}
                  >
                    <Plus size={11} /> Add all to queue
                  </button>
                </div>
                <div className="space-y-0.5">
                  {library.history.map((track, idx) => (
                    <LibTrackRow
                      key={track.id + idx}
                      track={track}
                      onPlay={() => playNow(toPlayable(track))}
                      onAdd={() => addToQueue(toPlayable(track))}
                      onAddToPlaylist={() => setAddToPlaylistTrack(toPlayable(track))}
                      onStartRadio={() => handleStartRadio(track.artist, track.track)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Playlists tab ── */}
        {activeTab === 'playlists' && (
          <>
            {/* New Playlist form */}
            {showNewPlaylist ? (
              <div className="flex items-center gap-2 mb-4">
                <input
                  autoFocus
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); if (e.key === 'Escape') setShowNewPlaylist(false); }}
                  placeholder="Playlist name…"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#FFFFFF', border: '1.5px solid #DCDBD7', color: '#131313' }}
                />
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#FF4D3D', color: '#FFFFFF' }}
                >
                  {creatingPlaylist ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                </button>
                <button onClick={() => setShowNewPlaylist(false)} style={{ color: '#9A9A9A' }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewPlaylist(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold mb-4 transition-all"
                style={{ border: '2px dashed #DCDBD7', color: '#9A9A9A' }}
              >
                <FolderPlus size={16} /> New Playlist
              </button>
            )}

            {library.playlists.length === 0 ? (
              <div className="text-center py-8">
                <ListMusic size={36} className="mx-auto mb-3" style={{ color: '#C2C0BB' }} />
                <p className="text-sm" style={{ color: '#9A9A9A' }}>No playlists yet</p>
              </div>
            ) : (
              library.playlists.map((pl) => (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  onPlayAll={() => {
                    if (!pl.tracks.length) return;
                    playLibraryTrack(pl.tracks, 0);
                  }}
                  onAddAllToQueue={() => pl.tracks.forEach((t) => addToQueue(toPlayable(t)))}
                  onDelete={() => deletePlaylist(pl.id)}
                  onPlayTrack={(t) => playNow(toPlayable(t))}
                  onAddTrack={(t) => addToQueue(toPlayable(t))}
                  onRemoveTrack={(trackId) => removeFromPlaylist(pl.id, trackId)}
                  onAddToPlaylist={(t) => setAddToPlaylistTrack(toPlayable(t))}
                />
              ))
            )}

            {/* Liked tracks to add to playlists */}
            {library.liked.length > 0 && library.playlists.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9A9A9A' }}>
                  Liked tracks — add to playlist
                </p>
                <div className="space-y-0.5">
                  {library.liked.map((t) => (
                    <LibTrackRow
                      key={t.id}
                      track={t}
                      onAddToPlaylist={() => setAddToPlaylistTrack(toPlayable(t))}
                      onAdd={() => addToQueue(toPlayable(t))}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <div className="h-24" />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
