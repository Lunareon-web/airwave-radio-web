import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const playlists = await sql`
    SELECT id, name, cover_art as "coverArt" FROM playlists
    WHERE user_id = ${session.user.id} ORDER BY created_at DESC
  `;
  const result = await Promise.all(
    playlists.map(async (p: Record<string, unknown>) => {
      const tracks = await sql`
        SELECT track_id as id, artist, track_name as track, cover_art as "coverArt", video_id as "videoId", position
        FROM playlist_tracks WHERE playlist_id = ${p.id as string} ORDER BY position ASC
      `;
      return { ...p, tracks };
    })
  );
  return NextResponse.json({ playlists: result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, coverArt } = await req.json();
  const rows = await sql`
    INSERT INTO playlists (user_id, name, cover_art) VALUES (${session.user.id}, ${name}, ${coverArt || null})
    RETURNING id, name, cover_art as "coverArt"
  `;
  return NextResponse.json({ playlist: { ...rows[0], tracks: [] } });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await sql`DELETE FROM playlists WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ success: true });
}
