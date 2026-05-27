import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`SELECT * FROM user_session WHERE user_id = ${session.user.id}`;
  if (!rows.length) return NextResponse.json({ session: null });
  return NextResponse.json({ session: rows[0] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const {
    discographyTracks, discographyArtist, discographyQuery,
    curatedTracks, currentPrompt, queue, playedTracks, skippedTracks,
    isShuffled, volume, queueTab, activeSource, activeIndex
  } = body;

  await sql`
    INSERT INTO user_session (
      user_id, discography_tracks, discography_artist, discography_query,
      curated_tracks, current_prompt, queue, played_tracks, skipped_tracks,
      is_shuffled, volume, queue_tab, active_source, active_index, updated_at
    ) VALUES (
      ${session.user.id},
      ${JSON.stringify(discographyTracks || [])}::jsonb,
      ${JSON.stringify(discographyArtist || null)}::jsonb,
      ${discographyQuery || ''},
      ${JSON.stringify(curatedTracks || [])}::jsonb,
      ${currentPrompt || ''},
      ${JSON.stringify(queue || [])}::jsonb,
      ${JSON.stringify(playedTracks || [])}::jsonb,
      ${JSON.stringify(skippedTracks || [])}::jsonb,
      ${isShuffled || false},
      ${volume ?? 0.75},
      ${queueTab || 'queue'},
      ${activeSource || null},
      ${activeIndex ?? -1},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      discography_tracks = ${JSON.stringify(discographyTracks || [])}::jsonb,
      discography_artist = ${JSON.stringify(discographyArtist || null)}::jsonb,
      discography_query = ${discographyQuery || ''},
      curated_tracks = ${JSON.stringify(curatedTracks || [])}::jsonb,
      current_prompt = ${currentPrompt || ''},
      queue = ${JSON.stringify(queue || [])}::jsonb,
      played_tracks = ${JSON.stringify(playedTracks || [])}::jsonb,
      skipped_tracks = ${JSON.stringify(skippedTracks || [])}::jsonb,
      is_shuffled = ${isShuffled || false},
      volume = ${volume ?? 0.75},
      queue_tab = ${queueTab || 'queue'},
      active_source = ${activeSource || null},
      active_index = ${activeIndex ?? -1},
      updated_at = NOW()
  `;
  return NextResponse.json({ success: true });
}
