import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT id, artist, track, cover_art as "coverArt", video_id as "videoId",
           EXTRACT(EPOCH FROM liked_at)::bigint * 1000 as "likedAt"
    FROM liked_tracks WHERE user_id = ${session.user.id} ORDER BY liked_at DESC
  `;
  return NextResponse.json({ liked: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, artist, track, coverArt, videoId } = await req.json();
  await sql`
    INSERT INTO liked_tracks (id, user_id, artist, track, cover_art, video_id)
    VALUES (${id}, ${session.user.id}, ${artist}, ${track}, ${coverArt || null}, ${videoId || null})
    ON CONFLICT (id, user_id) DO UPDATE SET artist=${artist}, track=${track}, cover_art=${coverArt || null}, video_id=${videoId || null}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await sql`DELETE FROM liked_tracks WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ success: true });
}
