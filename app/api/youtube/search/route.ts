import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Module-level quota tracker.
 * Maps API key → timestamp when it was marked exhausted.
 * Auto-clears after 24 h (aligned with YouTube's daily quota reset).
 * NOTE: Resets on cold-start / redeployment — that's fine.
 */
const quotaExhaustedAt = new Map<string, number>();

function isExhausted(key: string): boolean {
  const ts = quotaExhaustedAt.get(key);
  if (!ts) return false;
  if (Date.now() - ts > 24 * 60 * 60 * 1000) {
    quotaExhaustedAt.delete(key);
    return false;
  }
  return true;
}

function markExhausted(key: string): void {
  console.warn(`[youtube] Key ...${key.slice(-6)} quota exhausted — switching to next key`);
  quotaExhaustedAt.set(key, Date.now());
}

/** Collect all server-side keys from env vars (never sent to client). */
function getServerKeys(): string[] {
  const keys: string[] = [];
  // Primary pool: YOUTUBE_API_KEY_1 … YOUTUBE_API_KEY_9
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`YOUTUBE_API_KEY_${i}`];
    if (k && !keys.includes(k)) keys.push(k);
  }
  // Backward compat: plain YOUTUBE_API_KEY
  const legacy = process.env.YOUTUBE_API_KEY;
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    // User key (from Settings UI) has highest priority; server keys are the fallback pool.
    const userKey    = req.headers.get('X-YouTube-Key') || '';
    const serverKeys = getServerKeys();

    // Deduplicated candidate list: user key first, then server keys
    const candidates = [
      ...( userKey ? [userKey] : [] ),
      ...serverKeys.filter(k => k !== userKey),
    ];

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No YouTube API key configured. Add one in Settings or set YOUTUBE_API_KEY_1 in environment variables.' },
        { status: 400 }
      );
    }

    // ── Cache lookup ────────────────────────────────────────────────────────
    try {
      const cached = await sql`
        SELECT video_id, title, thumbnail FROM youtube_cache WHERE search_query = ${q}
      `;
      if (cached.length > 0) {
        return NextResponse.json({
          videoId:   cached[0].video_id,
          title:     cached[0].title,
          thumbnail: cached[0].thumbnail,
        });
      }
    } catch {
      // Table may not exist yet — skip cache, proceed to live search
    }

    // ── Try each key in order ───────────────────────────────────────────────
    let lastError = '';

    for (const key of candidates) {
      if (isExhausted(key)) continue;

      const url =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&maxResults=1&type=video` +
        `&q=${encodeURIComponent(q)}&key=${key}`;

      const res = await fetch(url);

      if (!res.ok) {
        const errText = await res.text();

        // Detect quota exhaustion (403 quotaExceeded / dailyLimitExceeded)
        if (res.status === 403) {
          try {
            const errJson = JSON.parse(errText);
            const reason  = errJson?.error?.errors?.[0]?.reason ?? '';
            if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
              markExhausted(key);
              lastError = 'quota exhausted';
              continue; // try next key
            }
          } catch { /* not JSON */ }
        }

        lastError = `YouTube API error (${res.status})`;
        continue;
      }

      const data = await res.json();
      const item = data?.items?.[0];
      if (!item) {
        return NextResponse.json({ error: 'No results found' }, { status: 404 });
      }

      const videoId   = item.id.videoId as string;
      const title     = item.snippet.title as string;
      const thumbnail =
        (item.snippet.thumbnails?.maxres?.url  as string) ||
        (item.snippet.thumbnails?.high?.url    as string) ||
        (item.snippet.thumbnails?.medium?.url  as string) ||
        (item.snippet.thumbnails?.default?.url as string) || '';

      // ── Cache result (non-fatal) ────────────────────────────────────────
      try {
        await sql`
          INSERT INTO youtube_cache (search_query, video_id, title, thumbnail)
          VALUES (${q}, ${videoId}, ${title}, ${thumbnail})
          ON CONFLICT (search_query) DO UPDATE
            SET video_id  = ${videoId},
                title     = ${title},
                thumbnail = ${thumbnail},
                cached_at = NOW()
        `;
      } catch { /* not critical */ }

      return NextResponse.json({ videoId, title, thumbnail });
    }

    // ── All candidates exhausted or failed ─────────────────────────────────
    const allExhausted = candidates.every(isExhausted);
    if (allExhausted) {
      return NextResponse.json(
        { error: 'All YouTube API keys have reached their daily quota. Please wait until midnight Pacific or add another key.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: lastError || 'YouTube search failed' }, { status: 500 });

  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
