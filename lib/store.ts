import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  ActiveSource, ActiveScreen, QueueTab,
  CuratedTrack, DiscographyArtist, LibraryStore,
  AppSettings, AIAdvisorData, ChatMessage, Playlist,
} from './types';

export type QueueSort = 'none' | 'artist' | 'track';

interface AppState {
  // Screens
  activeScreen: ActiveScreen;
  setActiveScreen: (s: ActiveScreen) => void;

  // Tracks
  discographyTracks: CuratedTrack[];
  discographyArtist: DiscographyArtist | null;
  discographyQuery: string;
  curatedTracks: CuratedTrack[];
  currentPrompt: string;
  queue: CuratedTrack[];
  libraryPlaylist: CuratedTrack[];
  playedTracks: CuratedTrack[];
  skippedTracks: CuratedTrack[];

  // Playback
  activeSource: ActiveSource | null;
  activeIndex: number;
  isPlaying: boolean;
  isShuffled: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isMuted: boolean;

  // UI
  queueTab: QueueTab;
  queueSort: QueueSort;
  isCurating: boolean;
  curationError: string | null;
  resolveMessage: string;
  showSettings: boolean;

  // Add-to-playlist modal (global)
  addToPlaylistTrack: CuratedTrack | null;
  /** Multi-track variant — used to add the entire Queue to a playlist at once. */
  addToPlaylistTracks: CuratedTrack[] | null;

  // AI Advisor
  advisorData: AIAdvisorData | null;
  isAnalyzing: boolean;

  // Muse chat
  chatMessages: ChatMessage[];

  // Library
  library: LibraryStore;

  // Settings
  settings: AppSettings;

  // Actions — Tracks
  setDiscographyTracks: (t: CuratedTrack[]) => void;
  setDiscographyArtist: (a: DiscographyArtist | null) => void;
  setDiscographyQuery: (q: string) => void;
  setCuratedTracks: (t: CuratedTrack[]) => void;
  setCurrentPrompt: (p: string) => void;
  setQueue: (q: CuratedTrack[]) => void;
  addToQueue: (t: CuratedTrack) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  sortQueueBy: (by: 'artist' | 'track') => void;
  setLibraryPlaylist: (t: CuratedTrack[]) => void;
  setPlayedTracks: (t: CuratedTrack[]) => void;
  setSkippedTracks: (t: CuratedTrack[]) => void;
  updateTrackInSource: (source: ActiveSource, index: number, updates: Partial<CuratedTrack>) => void;

  // Actions — Playback
  setActiveSource: (s: ActiveSource | null) => void;
  setActiveIndex: (i: number) => void;
  setIsPlaying: (v: boolean) => void;
  setIsShuffled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsMuted: (v: boolean) => void;
  playTrack: (source: ActiveSource, index: number) => void;
  playNow: (track: CuratedTrack) => void;
  playNext: () => void;
  playPrev: () => void;
  skipCurrent: () => void;

  // Actions — UI
  setQueueTab: (t: QueueTab) => void;
  setQueueSort: (s: QueueSort) => void;
  setIsCurating: (v: boolean) => void;
  setCurationError: (e: string | null) => void;
  setResolveMessage: (m: string) => void;
  setShowSettings: (v: boolean) => void;
  setAddToPlaylistTrack: (track: CuratedTrack | null) => void;
  setAddToPlaylistTracks: (tracks: CuratedTrack[] | null) => void;

  // Actions — AI Advisor
  setAdvisorData: (d: AIAdvisorData | null) => void;
  setIsAnalyzing: (v: boolean) => void;

  // Actions — Muse chat
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;

  // Actions — Library
  likeTrack: (track: CuratedTrack) => void;
  unlikeTrack: (id: string) => void;
  dislikeTrack: (id: string) => void;
  undislikeTrack: (id: string) => void;
  addToHistory: (track: CuratedTrack) => void;
  setLibrary: (lib: LibraryStore) => void;

  // Actions — Playlists
  createPlaylist: (name: string) => Promise<string | null>;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, track: CuratedTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;

  // Actions — Settings
  setSettings: (s: Partial<AppSettings>) => void;

  // Helpers
  getCurrentTrack: () => CuratedTrack | null;
  getSourceTracks: (source: ActiveSource) => CuratedTrack[];
}

function makeTrackId(track: CuratedTrack): string {
  return `${track.artist}__${track.track}`.toLowerCase().replace(/\s+/g, '_');
}

/** Deduplicated prepend for history/played/skipped lists (max 50 entries). */
function prependUnique(list: CuratedTrack[], track: CuratedTrack): CuratedTrack[] {
  return [track, ...list.filter(
    (t) => !(t.artist === track.artist && t.track === track.track)
  )].slice(0, 50);
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeScreen: 'radio',
    discographyTracks: [],
    discographyArtist: null,
    discographyQuery: '',
    curatedTracks: [],
    currentPrompt: '',
    queue: [],
    libraryPlaylist: [],
    playedTracks: [],
    skippedTracks: [],
    activeSource: null,
    activeIndex: -1,
    isPlaying: false,
    isShuffled: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
    isMuted: false,
    queueTab: 'queue',
    queueSort: 'none',
    isCurating: false,
    curationError: null,
    resolveMessage: '',
    showSettings: false,
    addToPlaylistTrack: null,
    addToPlaylistTracks: null,
    advisorData: null,
    isAnalyzing: false,
    chatMessages: [],
    library: { liked: [], disliked: [], history: [], playlists: [] },
    settings: { playbackMode: 'audio', sourceMode: 'youtube' },

    // Navigation
    setActiveScreen: (s) => set({ activeScreen: s }),

    // Tracks
    setDiscographyTracks: (t) => set({ discographyTracks: t }),
    setDiscographyArtist: (a) => set({ discographyArtist: a }),
    setDiscographyQuery: (q) => set({ discographyQuery: q }),
    setCuratedTracks: (t) => set({ curatedTracks: t }),
    setCurrentPrompt: (p) => set({ currentPrompt: p }),
    setQueue: (q) => set({ queue: q }),
    addToQueue: (t) => set((s) => ({
      queue: [...s.queue, { ...t, status: (t.videoId ? 'ready' : 'idle') as CuratedTrack['status'] }],
    })),
    removeFromQueue: (index) => set((s) => {
      const updated = s.queue.filter((_, i) => i !== index);
      if (s.activeSource === 'queue') {
        if (index < s.activeIndex) return { queue: updated, activeIndex: s.activeIndex - 1 };
        if (index === s.activeIndex) return { queue: updated, isPlaying: false, activeIndex: -1 };
      }
      return { queue: updated };
    }),
    reorderQueue: (from, to) => set((s) => {
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      if (s.activeSource === 'queue') {
        let ai = s.activeIndex;
        if (from === ai) ai = to;
        else if (from < ai && to >= ai) ai -= 1;
        else if (from > ai && to <= ai) ai += 1;
        return { queue: q, activeIndex: ai };
      }
      return { queue: q };
    }),
    sortQueueBy: (by) => set((s) => {
      const newSort: QueueSort = s.queueSort === by ? 'none' : by;
      if (newSort === 'none') return { queueSort: newSort };
      const activeId = s.activeSource === 'queue' && s.activeIndex >= 0
        ? `${s.queue[s.activeIndex]?.artist}::${s.queue[s.activeIndex]?.track}` : '';
      const sorted = [...s.queue].sort((a, b) =>
        by === 'artist' ? a.artist.localeCompare(b.artist) : a.track.localeCompare(b.track)
      );
      let newActiveIndex = s.activeIndex;
      if (activeId) {
        const found = sorted.findIndex((t) => `${t.artist}::${t.track}` === activeId);
        if (found !== -1) newActiveIndex = found;
      }
      return { queue: sorted, queueSort: newSort, activeIndex: newActiveIndex };
    }),
    setLibraryPlaylist: (t) => set({ libraryPlaylist: t }),
    setPlayedTracks: (t) => set({ playedTracks: t }),
    setSkippedTracks: (t) => set({ skippedTracks: t }),
    updateTrackInSource: (source, index, updates) => set((s) => {
      const key = source === 'discography' ? 'discographyTracks'
        : source === 'curated' ? 'curatedTracks'
        : source === 'queue' ? 'queue'
        : 'libraryPlaylist';
      const arr = [...(s[key] as CuratedTrack[])];
      if (arr[index]) arr[index] = { ...arr[index], ...updates };
      return { [key]: arr } as Partial<AppState>;
    }),

    // Playback
    setActiveSource: (s) => set({ activeSource: s }),
    setActiveIndex: (i) => set({ activeIndex: i }),
    setIsPlaying: (v) => set({ isPlaying: v }),
    setIsShuffled: (v) => set({ isShuffled: v }),
    setVolume: (v) => set({ volume: v }),
    setCurrentTime: (t) => set({ currentTime: t }),
    setDuration: (d) => set({ duration: d }),
    setIsMuted: (v) => set({ isMuted: v }),

    playTrack: (source, index) => {
      const tracks = get().getSourceTracks(source);
      const track = tracks[index];
      if (!track) return;
      set({ activeSource: source, activeIndex: index, isPlaying: true, currentTime: 0, duration: 0 });
      if (track.status === 'ready') get().addToHistory(track);
    },

    /** Push track to front of queue and play immediately — mirrors desktop "handlePlaySongNow" */
    playNow: (track) => {
      set((s) => ({
        queue: [
          { ...track, status: (track.videoId ? 'ready' : 'idle') as CuratedTrack['status'] },
          ...s.queue,
        ],
        activeSource: 'queue' as const,
        activeIndex: 0,
        isPlaying: true,
        currentTime: 0,
      }));
    },

    playNext: () => {
      const s = get();
      if (!s.activeSource) return;
      const tracks = s.getSourceTracks(s.activeSource);
      const current = tracks[s.activeIndex];
      if (current) {
        set((state) => ({ playedTracks: prependUnique(state.playedTracks, current) }));
      }
      const nextIndex = s.isShuffled
        ? Math.floor(Math.random() * tracks.length)
        : s.activeIndex + 1;
      if (nextIndex < tracks.length) {
        set({ activeIndex: nextIndex, isPlaying: true, currentTime: 0, duration: 0 });
        const track = tracks[nextIndex];
        if (track?.status === 'ready') get().addToHistory(track);
      } else {
        set({ isPlaying: false });
      }
    },

    playPrev: () => {
      const s = get();
      if (!s.activeSource) return;
      const prevIndex = s.activeIndex - 1;
      if (prevIndex >= 0) {
        set({ activeIndex: prevIndex, isPlaying: true, currentTime: 0, duration: 0 });
      }
    },

    skipCurrent: () => {
      const s = get();
      if (!s.activeSource) return;
      const tracks = s.getSourceTracks(s.activeSource);
      const current = tracks[s.activeIndex];
      if (current) {
        set((state) => ({ skippedTracks: prependUnique(state.skippedTracks, current) }));
      }
      const nextIndex = s.isShuffled
        ? Math.floor(Math.random() * tracks.length)
        : s.activeIndex + 1;
      if (nextIndex < tracks.length) {
        set({ activeIndex: nextIndex, isPlaying: true, currentTime: 0, duration: 0 });
        const track = tracks[nextIndex];
        if (track?.status === 'ready') get().addToHistory(track);
      } else {
        set({ isPlaying: false });
      }
    },

    // UI
    setQueueTab: (t) => set({ queueTab: t }),
    setQueueSort: (s) => set({ queueSort: s }),
    setIsCurating: (v) => set({ isCurating: v }),
    setCurationError: (e) => set({ curationError: e }),
    setResolveMessage: (m) => set({ resolveMessage: m }),
    setShowSettings: (v) => set({ showSettings: v }),
    setAddToPlaylistTrack:  (track)  => set({ addToPlaylistTrack: track }),
    setAddToPlaylistTracks: (tracks) => set({ addToPlaylistTracks: tracks }),

    // AI Advisor
    setAdvisorData: (d) => set({ advisorData: d }),
    setIsAnalyzing: (v) => set({ isAnalyzing: v }),

    // Muse chat
    addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
    clearChat: () => set({ chatMessages: [] }),

    // Library
    likeTrack: (track) => {
      const id = makeTrackId(track);
      set((s) => {
        const already = s.library.liked.find((t) => t.id === id);
        if (already) return {};
        return {
          library: {
            ...s.library,
            liked: [
              { id, artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, likedAt: Date.now() },
              ...s.library.liked,
            ],
            disliked: s.library.disliked.filter((d) => d !== id),
          },
        };
      });
      fetch('/api/library/liked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId }),
      }).catch(console.error);
    },

    unlikeTrack: (id) => {
      set((s) => ({ library: { ...s.library, liked: s.library.liked.filter((t) => t.id !== id) } }));
      fetch('/api/library/liked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },

    dislikeTrack: (id) => {
      set((s) => ({
        library: {
          ...s.library,
          disliked: [...new Set([...s.library.disliked, id])],
          liked: s.library.liked.filter((t) => t.id !== id),
        },
      }));
      fetch('/api/library/disliked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },

    undislikeTrack: (id) => {
      set((s) => ({ library: { ...s.library, disliked: s.library.disliked.filter((d) => d !== id) } }));
      fetch('/api/library/disliked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },

    addToHistory: (track) => {
      const id = makeTrackId(track);
      set((s) => {
        const filtered = s.library.history.filter((t) => t.id !== id);
        return {
          library: {
            ...s.library,
            history: [
              { id, artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, likedAt: Date.now() },
              ...filtered,
            ].slice(0, 100),
          },
        };
      });
      fetch('/api/library/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId }),
      }).catch(console.error);
    },

    setLibrary: (lib) => set({ library: lib }),

    // Playlists
    createPlaylist: async (name: string): Promise<string | null> => {
      try {
        const res = await fetch('/api/library/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const { playlist } = await res.json();
        if (playlist) {
          set((s) => ({ library: { ...s.library, playlists: [...s.library.playlists, playlist as Playlist] } }));
          return (playlist as Playlist).id;
        }
      } catch (e) { console.error(e); }
      return null;
    },

    deletePlaylist: (id) => {
      set((s) => ({ library: { ...s.library, playlists: s.library.playlists.filter((p) => p.id !== id) } }));
      fetch('/api/library/playlists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },

    addToPlaylist: (playlistId, track) => {
      const trackId = makeTrackId(track);
      set((s) => ({
        library: {
          ...s.library,
          playlists: s.library.playlists.map((p) =>
            p.id === playlistId && !p.tracks.some((t) => t.id === trackId)
              ? {
                  ...p,
                  tracks: [...p.tracks, {
                    id: trackId,
                    artist: track.artist,
                    track: track.track,
                    coverArt: track.coverArt,
                    videoId: track.videoId,
                    likedAt: Date.now(),
                  }],
                  coverArt: p.coverArt ?? track.coverArt,
                }
              : p
          ),
        },
      }));
      fetch(`/api/library/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, artist: track.artist, track: track.track, coverArt: track.coverArt, videoId: track.videoId, position: 0 }),
      }).catch(console.error);
    },

    removeFromPlaylist: (playlistId, trackId) => {
      set((s) => ({
        library: {
          ...s.library,
          playlists: s.library.playlists.map((p) =>
            p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p
          ),
        },
      }));
      fetch(`/api/library/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      }).catch(console.error);
    },

    // Settings
    setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

    // Helpers
    getCurrentTrack: () => {
      const s = get();
      if (!s.activeSource || s.activeIndex < 0) return null;
      return s.getSourceTracks(s.activeSource)[s.activeIndex] || null;
    },

    getSourceTracks: (source) => {
      const s = get();
      switch (source) {
        case 'discography': return s.discographyTracks;
        case 'curated': return s.curatedTracks;
        case 'queue': return s.queue;
        case 'library': return s.libraryPlaylist;
        default: return [];
      }
    },
  }))
);
