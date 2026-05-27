CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liked_tracks (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist TEXT NOT NULL,
  track TEXT NOT NULL,
  cover_art TEXT,
  video_id TEXT,
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS disliked_tracks (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist TEXT,
  track_name TEXT,
  cover_art TEXT,
  video_id TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_art TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  artist TEXT,
  track_name TEXT,
  cover_art TEXT,
  video_id TEXT,
  position INTEGER DEFAULT 0,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS user_session (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  discography_tracks JSONB DEFAULT '[]',
  discography_artist JSONB,
  discography_query TEXT DEFAULT '',
  curated_tracks JSONB DEFAULT '[]',
  current_prompt TEXT DEFAULT '',
  queue JSONB DEFAULT '[]',
  played_tracks JSONB DEFAULT '[]',
  skipped_tracks JSONB DEFAULT '[]',
  is_shuffled BOOLEAN DEFAULT FALSE,
  volume FLOAT DEFAULT 0.75,
  queue_tab TEXT DEFAULT 'queue',
  active_source TEXT,
  active_index INTEGER DEFAULT -1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  playback_mode TEXT DEFAULT 'audio',
  source_mode TEXT DEFAULT 'youtube',
  gemini_key TEXT,
  youtube_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS youtube_cache (
  search_query TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  title TEXT,
  thumbnail TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);
