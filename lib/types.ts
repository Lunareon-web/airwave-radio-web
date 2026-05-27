export type ActiveSource = 'discography' | 'curated' | 'queue' | 'library';
export type PlaybackMode = 'audio' | 'video';
export type QueueTab = 'queue' | 'played' | 'skipped' | 'saved';
export type ActiveScreen = 'radio' | 'queue' | 'muse' | 'library';

export interface CuratedTrack {
  artist: string;
  track: string;
  search_term?: string;
  status: 'idle' | 'searching' | 'ready' | 'failed';
  videoId?: string;
  coverArt?: string;
  streamUrl?: string;
  resolvedTitle?: string;
  isFallback?: boolean;
  album?: string;
  year?: string;
}

export interface MusicBubble {
  type: 'genre' | 'mood' | 'artist' | 'era' | 'song';
  label: string;
  value: string;
}

export interface AIAdvisorData {
  bubbles: MusicBubble[];
  seedPrompt: string;
}

export interface LibraryTrack {
  id: string;
  artist: string;
  track: string;
  coverArt?: string;
  videoId?: string;
  likedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  coverArt?: string;
  tracks: LibraryTrack[];
}

export interface LibraryStore {
  liked: LibraryTrack[];
  disliked: string[];
  history: LibraryTrack[];
  playlists: Playlist[];
}

export interface AppSettings {
  playbackMode: PlaybackMode;
  sourceMode: 'youtube' | 'soundcloud';
  geminiKey?: string;
  youtubeKey?: string;
}

export interface DiscographyArtist {
  name: string;
  genre?: string;
  origin?: string;
  period?: string;
  albums?: number;
  listeners?: string;
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'muse';
  content: string;
  tracks?: CuratedTrack[];
  timestamp: number;
}
