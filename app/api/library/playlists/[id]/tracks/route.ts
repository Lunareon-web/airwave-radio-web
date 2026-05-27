import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: playlistId } = await params;
  const { trackId, artist, track, coverArt, videoId, position } = await req.json();

  // Verify playlist belongs to user
  const pl = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${session.user.id}`;
  if (!pl.length) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

  await sql`
    INSERT INTO playlist_tracks (playlist_id, track_id, artist, track_name, cover_art, video_id, position)
    VALUES (${playlistId}, ${trackId}, ${artist}, ${track}, ${coverArt || null}, ${videoId || null}, ${position || 0})
    ON CONFLICT (playlist_id, track_id) DO UPDATE SET position = ${position || 0}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: playlistId } = await params;
  const { trackId } = await req.json();

  const pl = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${session.user.id}`;
  if (!pl.length) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

  await sql`DELETE FROM playlist_tracks WHERE playlist_id = ${playlistId} AND track_id = ${trackId}`;
  return NextResponse.json({ success: true });
}
