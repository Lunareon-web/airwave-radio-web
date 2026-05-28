'use client';

/**
 * BackgroundResolver — eagerly resolves YouTube videoId + thumbnail for every
 * idle track across all sources (discography, curated, queue).
 *
 * It runs as a sequential, throttled loop so it never hammers the YouTube API.
 * The loop restarts whenever a source gains new tracks (length change).
 * YTPlayer handles the active track + next 3 at higher priority; this component
 * handles the rest so thumbnails appear in lists before a track is played.
 */

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { ActiveSource } from '@/lib/types';

const SOURCES: ActiveSource[] = ['discography', 'curated', 'queue'];
const THROTTLE_MS = 450; // ms between requests

export function BackgroundResolver() {
  // Re-run whenever a source gains or loses tracks
  const discoLen   = useAppStore((s) => s.discographyTracks.length);
  const curatedLen = useAppStore((s) => s.curatedTracks.length);
  const queueLen   = useAppStore((s) => s.queue.length);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      for (const source of SOURCES) {
        if (cancelled) return;

        // Snapshot the current track list for this source
        const tracks = useAppStore.getState().getSourceTracks(source);

        for (let i = 0; i < tracks.length; i++) {
          if (cancelled) return;

          // Always read the LATEST status to avoid racing with YTPlayer
          const current = useAppStore.getState().getSourceTracks(source)[i];
          if (!current || current.status !== 'idle') continue;

          // Mark as searching
          useAppStore.getState().updateTrackInSource(source, i, { status: 'searching' });

          const query =
            current.search_term || `${current.artist} ${current.track} official audio`;
          const state = useAppStore.getState();
          const headers: Record<string, string> = {};
          if (state.settings.youtubeKey) headers['X-YouTube-Key'] = state.settings.youtubeKey;

          try {
            const res  = await fetch(
              `/api/youtube/search?q=${encodeURIComponent(query)}`,
              { headers }
            );
            const data = await res.json();

            if (!cancelled) {
              if (data.videoId) {
                useAppStore.getState().updateTrackInSource(source, i, {
                  status:        'ready',
                  videoId:       data.videoId,
                  coverArt:      data.thumbnail
                                   || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
                  resolvedTitle: data.title,
                });
              } else {
                useAppStore.getState().updateTrackInSource(source, i, { status: 'failed' });
              }
            }
          } catch {
            if (!cancelled) {
              useAppStore.getState().updateTrackInSource(source, i, { status: 'failed' });
            }
          }

          // Throttle between requests
          await new Promise<void>((r) => setTimeout(r, THROTTLE_MS));
        }
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoLen, curatedLen, queueLen]);

  return null;
}
