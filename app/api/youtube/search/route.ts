import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    const youtubeKey = req.headers.get('X-YouTube-Key') || process.env.YOUTUBE_API_KEY;
    if (!youtubeKey) {
      return NextResponse.json({ error: 'YouTube API key required' }, { status: 400 });
    }

    // Check cache
    const cached = await sql`SELECT video_id, title, thumbnail FROM youtube_cache WHERE search_query = ${q}`;
    if (cached.length > 0) {
      return NextResponse.json({
        videoId: cached[0].video_id,
        title: cached[0].title,
        thumbnail: cached[0].thumbnail
      });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=${encodeURIComponent(q)}&key=${youtubeKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `YouTube API error: ${err}` }, { status: 500 });
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) {
      return NextResponse.json({ error: 'No results found' }, { status: 404 });
    }
    const videoId = item.id.videoId;
    const title = item.snippet.title;
    const thumbnail = item.snippet.thumbnails?.default?.url || '';

    // Cache result
    await sql`
      INSERT INTO youtube_cache (search_query, video_id, title, thumbnail)
      VALUES (${q}, ${videoId}, ${title}, ${thumbnail})
      ON CONFLICT (search_query) DO UPDATE SET video_id = ${videoId}, title = ${title}, thumbnail = ${thumbnail}, cached_at = NOW()
    `;

    return NextResponse.json({ videoId, title, thumbnail });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
