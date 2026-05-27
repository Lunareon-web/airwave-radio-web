import { NextRequest, NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db';

// Schema embedded directly — avoids fs.readFileSync issues on serverless/edge
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS liked_tracks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist TEXT NOT NULL,
    track TEXT NOT NULL,
    cover_art TEXT,
    video_id TEXT,
    liked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS disliked_tracks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS history (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist TEXT,
    track_name TEXT,
    cover_art TEXT,
    video_id TEXT,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cover_art TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    artist TEXT,
    track_name TEXT,
    cover_art TEXT,
    video_id TEXT,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (playlist_id, track_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_session (
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
  )`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    playback_mode TEXT DEFAULT 'audio',
    source_mode TEXT DEFAULT 'youtube',
    gemini_key TEXT,
    youtube_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS youtube_cache (
    search_query TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    title TEXT,
    thumbnail TEXT,
    cached_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

// Repair statements — run after CREATE TABLE to patch pre-existing tables
const REPAIR_STATEMENTS = [
  // Add email unique constraint if missing (dedup first, then add constraint)
  `DELETE FROM users WHERE id NOT IN (
    SELECT DISTINCT ON (email) id FROM users ORDER BY email, created_at ASC
  )`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'users_email_key' AND conrelid = 'users'::regclass
    ) THEN
      ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
  END $$`,
];

/**
 * POST /api/db/migrate
 * Runs all CREATE TABLE IF NOT EXISTS statements + repair patches.
 * Protected by x-migrate-secret header = AUTH_SECRET env var.
 * Does NOT require user login — users table may not exist yet on first run.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migrate-secret');
  if (!secret || secret !== process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized — send header: x-migrate-secret: <AUTH_SECRET>' },
      { status: 401 }
    );
  }

  const results: string[] = [];
  const pool = getPool();
  const client = await pool.connect();
  try {
    for (const stmt of SCHEMA_STATEMENTS) {
      await client.query(stmt);
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      results.push(match ? `✓ ${match[1]}` : '✓ statement ok');
    }
    // Run repair patches
    for (const stmt of REPAIR_STATEMENTS) {
      await client.query(stmt);
    }
    results.push('✓ repair patches applied');
    return NextResponse.json({ success: true, tables: results });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: String(error), partial: results }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/db/migrate?email=x
 * Removes a user by email (admin reset for broken accounts).
 */
export async function DELETE(req: NextRequest) {
  const secret = req.headers.get('x-migrate-secret');
  if (!secret || secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 });
  try {
    const result = await sql`DELETE FROM users WHERE email = ${email} RETURNING email`;
    return NextResponse.json({ deleted: result.length, email });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/db/migrate
 * Returns list of existing tables — quick health check.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-migrate-secret');
  if (!secret || secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rows = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const tables = rows.map((r: Record<string, unknown>) => r.tablename as string);
    const expected = ['disliked_tracks','history','liked_tracks','playlist_tracks','playlists','user_session','user_settings','users','youtube_cache'];
    const missing  = expected.filter(t => !tables.includes(t));
    return NextResponse.json({ tables, missing, ready: missing.length === 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
