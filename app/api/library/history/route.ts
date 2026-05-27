import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT id, artist, track_name as track, cover_art as "coverArt", video_id as "videoId",
           EXTRACT(EPOCH FROM played_at)::bigint * 1000 as "likedAt"
    FROM history WHERE user_id = ${session.user.id} ORDER BY played_at DESC LIMIT 100
  `;
  return NextResponse.json({ history: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, artist, track, coverArt, videoId } = await req.json();
  await sql`
    INSERT INTO history (id, user_id, artist, track_name, cover_art, video_id)
    VALUES (${id}, ${session.user.id}, ${artist}, ${track}, ${coverArt || null}, ${videoId || null})
    ON CONFLICT (id, user_id) DO UPDATE SET played_at = NOW()
  `;
  return NextResponse.json({ success: true });
}
