import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT playback_mode as "playbackMode", source_mode as "sourceMode", gemini_key as "geminiKey", youtube_key as "youtubeKey"
    FROM user_settings WHERE user_id = ${session.user.id}
  `;
  if (!rows.length) {
    return NextResponse.json({
      settings: { playbackMode: 'audio', sourceMode: 'youtube', geminiKey: '', youtubeKey: '' }
    });
  }
  return NextResponse.json({ settings: rows[0] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { playbackMode, sourceMode, geminiKey, youtubeKey } = await req.json();
  await sql`
    INSERT INTO user_settings (user_id, playback_mode, source_mode, gemini_key, youtube_key, updated_at)
    VALUES (${session.user.id}, ${playbackMode || 'audio'}, ${sourceMode || 'youtube'}, ${geminiKey || null}, ${youtubeKey || null}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      playback_mode = ${playbackMode || 'audio'},
      source_mode = ${sourceMode || 'youtube'},
      gemini_key = ${geminiKey || null},
      youtube_key = ${youtubeKey || null},
      updated_at = NOW()
  `;
  return NextResponse.json({ success: true });
}
