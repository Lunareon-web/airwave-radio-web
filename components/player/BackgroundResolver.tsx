'use client';

/**
 * BackgroundResolver — resolves YouTube videoId + thumbnail for idle tracks
 * across all sources so cover art appears before a track is played.
 *
 * Throttle: 3 s between requests (keeps daily quota comfortable).
 * Priority : skips the active track + next 5 — YTPlayer handles those at
 *            higher priority.
 * Restart  : re-runs whenever a source gains new tracks (length change).
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { ActiveSource } from '@/lib/types';

const SOURCES: ActiveSource[] = ['discography', 'curated', 'queue', 'library'];
// 1.5 s throttle — faster cover-art loading while still being quota-friendly.
// YTPlayer's active window is only current + next 1 now (pre-fetch = 2),
// so BackgroundResolver skips only those 2 and gets to other tracks sooner.
const THROTTLE_MS = 1500;

export function BackgroundResolver() {
  const discoLen   = useAppStore((s) => s.discographyTracks.length);
  const curatedLen = useAppStore((s) => s.curatedTracks.length);
  const queueLen   = useAppStore((s) => s.queue.length);
  const libraryLen = useAppStore((s) => s.libraryPlaylist.length);

  // cancelRef lets us abort an in-progress run when deps change
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      for (const source of SOURCES) {
        if (cancelRef.current) return;

        const tracks = useAppStore.getState().getSourceTracks(source);

        for (let i = 0; i < tracks.length; i++) {
          if (cancelRef.current) return;

          // Always read latest status to avoid racing with YTPlayer
          const current = useAppStore.getState().getSourceTracks(source)[i];
          if (!current || current.status !== 'idle') continue;

          // Leave YTPlayer's active + next-1 window alone (pre-fetch = 2 tracks)
          const { activeIndex, activeSource } = useAppStore.getState();
          if (source === activeSource && i >= activeIndex && i <= activeIndex + 1) continue;

          useAppStore.getState().updateTrackInSource(source, i, { status: 'searching' });

          const query =
            current.search_term || `${current.artist} ${current.track} official audio`;
          const headers: Record<string, string> = {};
          // user key (if set) takes priority — server keys are the automatic fallback
          const uk = useAppStore.getState().settings.youtubeKey;
          if (uk) headers['X-YouTube-Key'] = uk;

          try {
            const res  = await fetch(
              `/api/youtube/search?q=${encodeURIComponent(query)}`,
              { headers }
            );
            const data = await res.json();

            if (!cancelRef.current) {
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
            if (!cancelRef.current) {
              useAppStore.getState().updateTrackInSource(source, i, { status: 'failed' });
            }
          }

          // Throttle — also checks cancel so we exit quickly when deps change
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, THROTTLE_MS);
            // poll cancel flag every 200 ms so we can abort the sleep
            const poll = setInterval(() => {
              if (cancelRef.current) { clearTimeout(t); clearInterval(poll); resolve(); }
            }, 200);
            // clean up poll once timer fires naturally
            setTimeout(() => clearInterval(poll), THROTTLE_MS + 50);
          });
        }
      }
    };

    run();
    return () => { cancelRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoLen, curatedLen, queueLen, libraryLen]);

  return null;
}
