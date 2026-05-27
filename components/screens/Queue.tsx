'use client';

import { useState } from 'react';
import { X, GripVertical, Plus, Play, Pause, SkipForward, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AlbumArt } from '@/components/ui/AlbumArt';
import { Chip } from '@/components/ui/Chip';
import type { CuratedTrack, QueueTab } from '@/lib/types';

const TABS: { id: QueueTab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'played', label: 'Played' },
  { id: 'skipped', label: 'Skipped' },
];

function TrackRow({
  track,
  index,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
  onAddToQueue,
  showGrip = false,
}: {
  track: CuratedTrack;
  index: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onAddToQueue?: () => void;
  showGrip?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-1 rounded-xl transition-all"
      style={{ background: isActive ? 'rgba(255,77,61,0.06)' : 'transparent' }}
    >
      {showGrip && (
        <div style={{ color: '#C2C0BB', cursor: 'grab', flexShrink: 0 }}>
          <GripVertical size={16} />
        </div>
      )}
      {onAddToQueue && (
        <button
          onClick={onAddToQueue}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
          style={{ background: '#E8E6E1', color: '#6B6B6B' }}
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
        <p className="text-sm font-semibold truncate" style={{ color: '#131313' }}>{track.track}</p>
        <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>{track.artist}</p>
      </div>
      {track.album && (
        <Chip size="sm" variant="default">{track.album}</Chip>
      )}
      {isActive && (
        <button onClick={onPlay} className="flex-shrink-0" style={{ color: '#FF4D3D' }}>
          {isPlaying ? <Pause size={18} fill="#FF4D3D" /> : <Play size={18} fill="#FF4D3D" />}
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="flex-shrink-0 transition-opacity hover:opacity-60" style={{ color: '#C2C0BB' }}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

export function Queue() {
  const {
    queue, setQueue, playedTracks, skippedTracks,
    activeSource, activeIndex, isPlaying,
    setIsPlaying, playTrack, removeFromQueue, reorderQueue,
    addToQueue, curatedTracks, setActiveScreen,
    queueTab, setQueueTab,
  } = useAppStore();

  const getCurrentTrack = useAppStore((s) => s.getCurrentTrack);
  const currentTrack = getCurrentTrack();

  const tabTracks: Record<QueueTab, CuratedTrack[]> = {
    queue,
    played: playedTracks,
    skipped: skippedTracks,
    saved: [],
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Mini player */}
      {currentTrack && (
        <div
          className="mx-4 mb-4 rounded-2xl p-3 flex items-center gap-3"
          style={{ background: '#0E0E0E' }}
        >
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
            {isPlaying ? <Pause size={16} color="white" fill="white" /> : <Play size={16} color="white" fill="white" />}
          </button>
          <button onClick={() => useAppStore.getState().playNext()} style={{ color: '#6B6B6B' }}>
            <SkipForward size={18} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setQueueTab(tab.id)}
            className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{
              background: queueTab === tab.id ? '#0E0E0E' : '#E8E6E1',
              color: queueTab === tab.id ? '#FFFFFF' : '#6B6B6B',
            }}
          >
            {tab.label}
            {tab.id === 'queue' && queue.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: 'rgba(255,77,61,0.2)', color: '#FF4D3D' }}>
                {queue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-4">
        {queueTab === 'queue' && (
          <>
            {queue.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>
                Queue is empty. Add tracks from Muse or Library.
              </p>
            ) : (
              <Reorder.Group
                axis="y"
                values={queue}
                onReorder={(newOrder) => setQueue(newOrder)}
                className="space-y-1"
              >
                {queue.map((track, i) => (
                  <Reorder.Item key={`${track.artist}-${track.track}-${i}`} value={track}>
                    <div className="flex items-center gap-2">
                      <div style={{ color: '#C2C0BB', cursor: 'grab', flexShrink: 0 }}>
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1">
                        <TrackRow
                          track={track}
                          index={i}
                          isActive={activeSource === 'queue' && activeIndex === i}
                          isPlaying={isPlaying && activeSource === 'queue' && activeIndex === i}
                          onPlay={() => playTrack('queue', i)}
                          onRemove={() => removeFromQueue(i)}
                        />
                      </div>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </>
        )}

        {queueTab === 'played' && (
          <div className="space-y-1">
            {playedTracks.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>No played tracks yet.</p>
            ) : (
              playedTracks.slice().reverse().map((track, i) => (
                <TrackRow
                  key={i}
                  track={track}
                  index={i}
                  onAddToQueue={() => addToQueue(track)}
                />
              ))
            )}
          </div>
        )}

        {queueTab === 'skipped' && (
          <div className="space-y-1">
            {skippedTracks.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9A9A9A' }}>No skipped tracks.</p>
            ) : (
              skippedTracks.slice().reverse().map((track, i) => (
                <TrackRow
                  key={i}
                  track={track}
                  index={i}
                  onAddToQueue={() => addToQueue(track)}
                />
              ))
            )}
          </div>
        )}

        {/* Suggestions from curated */}
        {queueTab === 'queue' && curatedTracks.length > 0 && (
          <div className="mt-6 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9A9A9A' }}>
              Muse Suggests
            </p>
            <div className="space-y-1">
              {curatedTracks.slice(0, 5).map((track, i) => (
                <TrackRow
                  key={i}
                  track={track}
                  index={i}
                  onAddToQueue={() => addToQueue({ ...track })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-24" />
    </div>
  );
}
