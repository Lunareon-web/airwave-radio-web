'use client';

import {
  X, GripVertical, Plus, Play, Pause, SkipForward,
  Heart, ThumbsDown, Sparkles, ArrowUpDown, Trash2,
  Loader2, CheckCircle2, ListMusic, ListPlus,
} from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { CuratedTrack, QueueTab } from '@/lib/types';

const TABS: { id: QueueTab; label: string }[] = [
  { id: 'queue',   label: 'Queue' },
  { id: 'played',  label: 'Played' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'saved',   label: 'Saved' },
];

/** Small spinner/check badge shown next to track title */
function StatusBadge({ status }: { status?: string }) {
  if (status === 'searching') {
    return <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: '#FF4D3D' }} />;
  }
  if (status === 'ready') {
    return <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: '#4CAF50' }} />;
  }
  return null;
}

function TrackRow({
  track,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
  onAddToQueue,
  onPlayNow,
  onAddToPlaylist,
  showGrip = false,
  onLike,
  onDislike,
  isLiked,
  isDisliked,
  onStartRadio,
  onArtistClick,
}: {
  track: CuratedTrack;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onAddToQueue?: () => void;
  onPlayNow?: () => void;
  onAddToPlaylist?: () => void;
  showGrip?: boolean;
  onLike?: () => void;
  onDislike?: () => void;
  isLiked?: boolean;
  isDisliked?: boolean;
  onStartRadio?: () => void;
  onArtistClick?: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2.5 py-2.5 px-1 rounded-xl transition-all"
      style={{ background: isActive ? 'rgba(255,77,61,0.06)' : 'transparent' }}
    >
      {/* Left action: play-now pill (history/skipped rows) */}
      {onPlayNow && !showGrip && (
        <button
          onClick={onPlayNow}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
          style={{ background: '#FF4D3D' }}
          title="Play now"
        >
          <Play size={12} color="white" fill="white" />
        </button>
      )}

      {/* Left action: add-to-queue pill (muse suggestions without playNow) */}
      {onAddToQueue && !showGrip && !onPlayNow && (
        <button
          onClick={onAddToQueue}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
          style={{ background: '#E8E6E1', color: '#6B6B6B' }}
          title="Add to queue"
        >
          <Plus size={14} />
        </button>
      )}

      <AlbumArt
        artist={track.artist}
        track={track.track}
        coverArt={track.coverArt}
        size={44}
        rounded="xl"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {onPlay ? (
            <button
              onClick={onPlay}
              className="text-sm font-semibold truncate text-left leading-tight hover:opacity-70 transition-opacity"
              style={{ color: isActive ? '#FF4D3D' : '#131313' }}
              title="Play"
            >
              {track.track}
            </button>
          ) : (
            <p className="text-sm font-semibold truncate" style={{ color: '#131313' }}>{track.track}</p>
          )}
          <StatusBadge status={track.status} />
        </div>
        {onArtistClick ? (
          <button
            onClick={onArtistClick}
            className="text-xs truncate text-left hover:opacity-70 transition-opacity hover:underline"
            style={{ color: '#9A9A9A' }}
            title={`Browse ${track.artist} discography`}
          >
            {track.artist}
          </button>
        ) : (
          <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>{track.artist}</p>
        )}
      </div>

      {track.album && <Chip size="sm" variant="default">{track.album}</Chip>}

      {/* Right action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Secondary add-to-queue when we also have playNow */}
        {onAddToQueue && onPlayNow && (
          <button
            onClick={onAddToQueue}
            title="Add to queue"
            style={{ color: '#C2C0BB' }}
            className="hover:opacity-80 transition-opacity"
          >
            <Plus size={15} />
          </button>
        )}
        {onAddToPlaylist && (
          <button
            onClick={onAddToPlaylist}
            title="Add to playlist"
            style={{ color: '#C2C0BB' }}
            className="hover:opacity-80 transition-opacity"
          >
            <ListMusic size={15} />
          </button>
        )}
        {onStartRadio && (
          <button
            onClick={onStartRadio}
            title="Start similar radio"
            style={{ color: '#C2C0BB' }}
            className="hover:text-[#FF4D3D] transition-colors"
          >
            <Sparkles size={15} />
          </button>
        )}
        {onLike && (
          <button onClick={onLike} title="Like" style={{ color: isLiked ? '#FF4D3D' : '#C2C0BB' }} className="transition-colors">
            <Heart size={15} fill={isLiked ? '#FF4D3D' : 'none'} />
          </button>
        )}
        {onDislike && (
          <button onClick={onDislike} title="Dislike" style={{ color: isDisliked ? '#6B6B6B' : '#C2C0BB' }} className="transition-colors">
            <ThumbsDown size={15} fill={isDisliked ? '#6B6B6B' : 'none'} />
          </button>
        )}
        {onPlay && (
          <button
            onClick={onPlay}
            className="transition-opacity hover:opacity-70"
            title={isActive && isPlaying ? 'Pause' : 'Play'}
          >
            {isActive && isPlaying
              ? <Pause size={18} color="#FF4D3D" fill="#FF4D3D" />
              : <Play  size={18} color="#9A9A9A"  fill="#9A9A9A" />}
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="transition-opacity hover:opacity-60" style={{ color: '#C2C0BB' }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Draggable wrapper — drag only via the GripVertical handle ───────────────
function DraggableItem({
  track, i, activeSource, activeIndex, isPlaying: globalPlaying,
  makeTrackId, likedSet, dislikedSet,
  playTrack, removeFromQueue, setAddToPlaylistTrack,
  likeTrack, unlikeTrack, dislikeTrack, undislikeTrack,
  handleStartRadio, setDiscographyTracks, setDiscographyArtist,
  setDiscographyQuery, setActiveScreen,
}: {
  track: CuratedTrack; i: number;
  activeSource: string | null; activeIndex: number; isPlaying: boolean;
  makeTrackId: (t: CuratedTrack) => string;
  likedSet: Set<string>; dislikedSet: Set<string>;
  playTrack: (s: 'queue', idx: number) => void;
  removeFromQueue: (idx: number) => void;
  setAddToPlaylistTrack: (t: CuratedTrack) => void;
  likeTrack: (t: CuratedTrack) => void;
  unlikeTrack: (id: string) => void;
  dislikeTrack: (id: string) => void;
  undislikeTrack: (id: string) => void;
  handleStartRadio: (t: CuratedTrack) => void;
  setDiscographyTracks: (t: CuratedTrack[]) => void;
  setDiscographyArtist: (a: null) => void;
  setDiscographyQuery: (q: string) => void;
  setActiveScreen: (s: import('@/lib/types').ActiveScreen) => void;
}) {
  const controls = useDragControls();
  const tid = makeTrackId(track);

  return (
    <Reorder.Item
      key={`${track.artist}-${track.track}-${i}`}
      value={track}
      dragListener={false}
      dragControls={controls}
    >
      <div className="flex items-center gap-2">
        {/* ── Drag handle — only this triggers drag ── */}
        <div
          onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
          style={{ color: '#C2C0BB', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
        >
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <TrackRow
            track={track}
            isActive={activeSource === 'queue' && activeIndex === i}
            isPlaying={globalPlaying && activeSource === 'queue' && activeIndex === i}
            onPlay={() => playTrack('queue', i)}
            onRemove={() => removeFromQueue(i)}
            onAddToPlaylist={() => setAddToPlaylistTrack(track)}
            isLiked={likedSet.has(tid)}
            isDisliked={dislikedSet.has(tid)}
            onLike={() => likedSet.has(tid) ? unlikeTrack(tid) : likeTrack(track)}
            onDislike={() => dislikedSet.has(tid) ? undislikeTrack(tid) : dislikeTrack(tid)}
            onStartRadio={() => handleStartRadio(track)}
            onArtistClick={() => {
              setDiscographyTracks([]);
              setDiscographyArtist(null);
              setDiscographyQuery(track.artist);
              setActiveScreen('library');
            }}
          />
        </div>
      </div>
    </Reorder.Item>
  );
}

export function Queue({
  desktopMode = false,
  embeddedMode = false,
}: {
  desktopMode?: boolean;
  embeddedMode?: boolean;
}) {
  const {
    queue, setQueue, playedTracks, skippedTracks,
    activeSource, activeIndex, isPlaying,
    setIsPlaying, playTrack, removeFromQueue,
    addToQueue, playNow, curatedTracks, setActiveScreen,
    queueTab, setQueueTab, queueSort, sortQueueBy,
    library, likeTrack, unlikeTrack, dislikeTrack, undislikeTrack,
    setCurrentPrompt, setAddToPlaylistTrack, setAddToPlaylistTracks,
    setDiscographyTracks, setDiscographyArtist, setDiscographyQuery,
  } = useAppStore();

  const getCurrentTrack = useAppStore((s) => s.getCurrentTrack);
  const currentTrack = getCurrentTrack();

  // Convert library history → CuratedTrack for the Played tab (same data as Library > History)
  const playedHistory: CuratedTrack[] = library.history.map((lt) => ({
    artist: lt.artist,
    track: lt.track,
    coverArt: lt.coverArt,
    videoId: lt.videoId,
    status: 'ready' as const,
  }));

  // Convert liked library tracks to CuratedTrack format for the Saved tab
  const savedTracks: CuratedTrack[] = library.liked.map((lt) => ({
    artist: lt.artist,
    track: lt.track,
    coverArt: lt.coverArt,
    videoId: lt.videoId,
    status: 'ready' as const,
  }));

  const makeTrackId = (t: CuratedTrack) =>
    `${t.artist}__${t.track}`.toLowerCase().replace(/\s+/g, '_');

  const likedSet    = new Set(library.liked.map((t) => `${t.artist}__${t.track}`.toLowerCase().replace(/\s+/g, '_')));
  const dislikedSet = new Set(library.disliked);

  const handleStartRadio = (track: CuratedTrack) => {
    setCurrentPrompt(`${track.artist} ${track.track} similar tracks radio`);
    setActiveScreen('muse');
  };

  const tabCount: Record<QueueTab, number> = {
    queue:   queue.length,
    played:  playedHistory.length,   // mirrors Library > History
    skipped: skippedTracks.length,
    saved:   library.liked.length,
  };

  // ── Root element height ───────────────────────────────────────────────────
  // embeddedMode: natural height, parent (NowPlaying) handles scroll
  // standalone mobile: full-viewport height so inner flex-1 works
  const rootStyle = embeddedMode ? {} : desktopMode ? {} : { height: '100svh' };

  return (
    <div className="flex flex-col" style={{ ...rootStyle, background: embeddedMode ? 'transparent' : undefined }}>

      {/* ── Standalone mobile header ── */}
      {!desktopMode && !embeddedMode && (
        <>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <button
              onClick={() => setActiveScreen('radio')}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: '#E8E6E1', color: '#6B6B6B' }}
            >
              <X size={18} />
            </button>
            <h2 className="text-base font-bold" style={{ color: '#131313' }}>Up Next</h2>
            <div className="w-9" />
          </div>

          {/* Mini player — standalone mobile only */}
          {currentTrack && (
            <div className="mx-4 mb-4 rounded-2xl p-3 flex items-center gap-3" style={{ background: '#0E0E0E' }}>
              <AlbumArt
                artist={currentTrack.artist}
                track={currentTrack.track}
                coverArt={currentTrack.coverArt}
                size={44}
                rounded="xl"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{currentTrack.track}</p>
                <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>{currentTrack.artist}</p>
              </div>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#FF4D3D' }}
              >
                {isPlaying
                  ? <Pause size={16} color="white" fill="white" />
                  : <Play  size={16} color="white" fill="white" />}
              </button>
              <button onClick={() => useAppStore.getState().skipCurrent()} style={{ color: '#6B6B6B' }}>
                <SkipForward size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Desktop queue header ── */}
      {desktopMode && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>Up Next</h2>
          {queue.length > 0 && (
            <button
              onClick={() => { useAppStore.getState().setActiveSource(null); useAppStore.getState().setActiveIndex(-1); useAppStore.getState().setIsPlaying(false); setQueue([]); }}
              style={{ color: '#C2C0BB' }} title="Clear queue"
              className="hover:opacity-70 transition-opacity"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* ── Embedded header (compact) ── */}
      {embeddedMode && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9A9A9A' }}>
            Up Next {queue.length > 0 && <span style={{ color: '#C2C0BB' }}>· {queue.length}</span>}
          </h3>
          {queue.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddToPlaylistTracks([...queue])}
                title="Queue zu Playlist hinzufügen"
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#9A9A9A' }}
              >
                <ListPlus size={15} />
              </button>
              <button
                onClick={() => { useAppStore.getState().setActiveSource(null); useAppStore.getState().setActiveIndex(-1); useAppStore.getState().setIsPlaying(false); setQueue([]); }}
                title="Clear queue"
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#C2C0BB' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 px-4 mb-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setQueueTab(tab.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0"
            style={{
              background: queueTab === tab.id ? '#0E0E0E' : '#E8E6E1',
              color:      queueTab === tab.id ? '#FFFFFF' : '#6B6B6B',
            }}
          >
            {tab.label}
            {tabCount[tab.id] > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{
                  background: queueTab === tab.id ? 'rgba(255,77,61,0.3)' : 'rgba(0,0,0,0.08)',
                  color:      queueTab === tab.id ? '#FF9990' : '#9A9A9A',
                }}
              >
                {tabCount[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Queue-tab toolbar: sort + save + clear ── */}
      {queueTab === 'queue' && queue.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold flex-1" style={{ color: '#9A9A9A' }}>Sort</span>
          <button
            onClick={() => sortQueueBy('artist')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: queueSort === 'artist' ? '#0E0E0E' : '#E8E6E1', color: queueSort === 'artist' ? '#FFFFFF' : '#6B6B6B' }}
          >
            <ArrowUpDown size={10} /> Artist
          </button>
          <button
            onClick={() => sortQueueBy('track')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: queueSort === 'track' ? '#0E0E0E' : '#E8E6E1', color: queueSort === 'track' ? '#FFFFFF' : '#6B6B6B' }}
          >
            <ArrowUpDown size={10} /> Title
          </button>
          {/* Save + Clear (only in standalone/desktop, not in embeddedMode where header shows them) */}
          {!embeddedMode && (
            <>
              <button
                onClick={() => setAddToPlaylistTracks([...queue])}
                title="Queue zu Playlist hinzufügen"
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#9A9A9A' }}
              >
                <ListPlus size={14} />
              </button>
              <button
                onClick={() => {
                  if (activeSource === 'queue') {
                    useAppStore.getState().setActiveSource(null);
                    useAppStore.getState().setActiveIndex(-1);
                    useAppStore.getState().setIsPlaying(false);
                  }
                  setQueue([]);
                }}
                style={{ color: '#C2C0BB' }}
                title="Clear queue"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Track list ── */}
      <div className={embeddedMode ? 'px-4' : 'flex-1 overflow-y-auto px-4'}>

        {/* ── Queue tab ── */}
        {queueTab === 'queue' && (
          queue.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>
              Queue is empty. Add tracks from Muse or Library.
            </p>
          ) : (
            <Reorder.Group
              axis="y"
              values={queue}
              onReorder={(newOrder) => setQueue(newOrder)}
              className="space-y-0.5"
            >
              {queue.map((track, i) => (
                <DraggableItem
                  key={`${track.artist}-${track.track}-${i}`}
                  track={track} i={i}
                  activeSource={activeSource} activeIndex={activeIndex} isPlaying={isPlaying}
                  makeTrackId={makeTrackId} likedSet={likedSet} dislikedSet={dislikedSet}
                  playTrack={playTrack} removeFromQueue={removeFromQueue}
                  setAddToPlaylistTrack={setAddToPlaylistTrack}
                  likeTrack={likeTrack} unlikeTrack={unlikeTrack}
                  dislikeTrack={dislikeTrack} undislikeTrack={undislikeTrack}
                  handleStartRadio={handleStartRadio}
                  setDiscographyTracks={setDiscographyTracks}
                  setDiscographyArtist={setDiscographyArtist}
                  setDiscographyQuery={setDiscographyQuery}
                  setActiveScreen={setActiveScreen}
                />
              ))}
            </Reorder.Group>
          )
        )}

        {/* ── Played tab — same data as Library > History ── */}
        {queueTab === 'played' && (
          <div className="space-y-0.5">
            {playedHistory.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>No played tracks yet.</p>
            ) : (
              playedHistory.map((track, i) => {
                const tid = makeTrackId(track);
                return (
                  <TrackRow
                    key={i} track={track}
                    onPlayNow={() => playNow({ ...track })}
                    onAddToQueue={() => addToQueue({ ...track })}
                    onAddToPlaylist={() => setAddToPlaylistTrack(track)}
                    onStartRadio={() => handleStartRadio(track)}
                    isLiked={likedSet.has(tid)}
                    isDisliked={dislikedSet.has(tid)}
                    onLike={() => likedSet.has(tid) ? unlikeTrack(tid) : likeTrack(track)}
                    onDislike={() => dislikedSet.has(tid) ? undislikeTrack(tid) : dislikeTrack(tid)}
                    onArtistClick={() => { setDiscographyTracks([]); setDiscographyArtist(null); setDiscographyQuery(track.artist); setActiveScreen('library'); }}
                  />
                );
              })
            )}
          </div>
        )}

        {/* ── Skipped tab ── */}
        {queueTab === 'skipped' && (
          <div className="space-y-0.5">
            {skippedTracks.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>No skipped tracks.</p>
            ) : (
              skippedTracks.map((track, i) => {
                const tid = makeTrackId(track);
                return (
                  <TrackRow
                    key={i} track={track}
                    onPlayNow={() => playNow({ ...track })}
                    onAddToQueue={() => addToQueue({ ...track })}
                    onAddToPlaylist={() => setAddToPlaylistTrack(track)}
                    onStartRadio={() => handleStartRadio(track)}
                    isLiked={likedSet.has(tid)}
                    isDisliked={dislikedSet.has(tid)}
                    onLike={() => likedSet.has(tid) ? unlikeTrack(tid) : likeTrack(track)}
                    onDislike={() => dislikedSet.has(tid) ? undislikeTrack(tid) : dislikeTrack(tid)}
                    onArtistClick={() => { setDiscographyTracks([]); setDiscographyArtist(null); setDiscographyQuery(track.artist); setActiveScreen('library'); }}
                  />
                );
              })
            )}
          </div>
        )}

        {/* ── Saved tab (liked tracks) ── */}
        {queueTab === 'saved' && (
          <div className="space-y-0.5">
            {savedTracks.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>No saved tracks yet. Like tracks to save them here.</p>
            ) : (
              savedTracks.map((track, i) => {
                const tid = makeTrackId(track);
                return (
                  <TrackRow
                    key={i} track={track}
                    onPlayNow={() => playNow({ ...track })}
                    onAddToQueue={() => addToQueue({ ...track })}
                    onAddToPlaylist={() => setAddToPlaylistTrack(track)}
                    isActive={activeSource === 'library' && activeIndex === i}
                    isPlaying={isPlaying && activeSource === 'library' && activeIndex === i}
                    onPlay={() => {
                      useAppStore.getState().setLibraryPlaylist(savedTracks);
                      useAppStore.getState().setActiveSource('library');
                      useAppStore.getState().setActiveIndex(i);
                      useAppStore.getState().setIsPlaying(true);
                      setActiveScreen('radio');
                    }}
                    isLiked
                    onLike={() => unlikeTrack(tid)}
                    onStartRadio={() => handleStartRadio(track)}
                    onArtistClick={() => { setDiscographyTracks([]); setDiscographyArtist(null); setDiscographyQuery(track.artist); setActiveScreen('library'); }}
                  />
                );
              })
            )}
          </div>
        )}

        {/* Muse suggestions when queue tab is active and empty */}
        {queueTab === 'queue' && queue.length === 0 && curatedTracks.length > 0 && (
          <div className="mt-4 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9A9A9A' }}>
              Muse Suggests
            </p>
            <div className="space-y-0.5">
              {curatedTracks.slice(0, 5).map((track, i) => (
                <TrackRow
                  key={i} track={track}
                  onAddToQueue={() => addToQueue({ ...track })}
                  onAddToPlaylist={() => setAddToPlaylistTrack(track)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottom padding */}
        {!embeddedMode && <div className="h-24" />}
        {embeddedMode && <div className="h-4" />}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
