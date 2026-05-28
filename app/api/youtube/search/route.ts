import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  ensureQuotaLoaded,
  isExhausted,
  markExhausted,
  getServerKeys,
  type LabeledKey,
} from '@/lib/youtube-quota';

// ─── Free fallback: Invidious + Piped instances ───────────────────────────────
// Used when all YouTube API keys are quota-exhausted.
// All instances are tried IN PARALLEL so the first response wins.
// This keeps total latency ≤ 4 s regardless of how many instances are down,
// which is critical for Vercel's 10-second serverless-function deadline.

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',               // US — often fastest from Vercel
  'https://yt.artemislena.eu',
  'https://invidious.tiekoetter.com',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space',
  'https://inv.nadeko.net',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://piped-api.codeberg.page',
];

type FallbackResult = { videoId: string; title: string; thumbnail: string };

/** Search one Invidious instance — throws on any failure. */
async function tryInvidious(instance: string, q: string): Promise<FallbackResult> {
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video&fields=videoId,title,videoThumbnails`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Array<{
    videoId?: string;
    title?: string;
    videoThumbnails?: Array<{ quality: string; url: string }>;
  }>;
  const item = data?.[0];
  if (!item?.videoId) throw new Error('no result');
  const thumbnail =
    item.videoThumbnails?.find((t) => t.quality === 'high')?.url ||
    item.videoThumbnails?.[0]?.url ||
    `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
  console.log(`[youtube-fallback] Invidious hit (${instance})`);
  return { videoId: item.videoId, title: item.title || q, thumbnail };
}

/** Search one Piped instance — throws on any failure. */
async function tryPiped(instance: string, q: string): Promise<FallbackResult> {
  const url = `${instance}/search?q=${encodeURIComponent(q)}&filter=music_songs`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    items?: Array<{ url?: string; title?: string; thumbnail?: string }>;
  };
  const item = data?.items?.[0];
  if (!item?.url) throw new Error('no result');
  const videoId = new URL('https://www.youtube.com' + item.url).searchParams.get('v');
  if (!videoId) throw new Error('no videoId');
  console.log(`[youtube-fallback] Piped hit (${instance})`);
  return {
    videoId,
    title:     item.title || q,
    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * Search via quota-free Invidious / Piped as last-resort fallback.
 * Fires ALL instances simultaneously — returns the first valid response
 * (Promise.any). Total latency = fastest responding instance, not the sum.
 */
async function searchFallback(q: string): Promise<FallbackResult | null> {
  try {
    return await Promise.any([
      ...INVIDIOUS_INSTANCES.map((inst) => tryInvidious(inst, q)),
      ...PIPED_INSTANCES.map((inst) => tryPiped(inst, q)),
    ]);
  } catch {
    // AggregateError: all instances failed / timed out
    return null;
  }
}

// ─── Cache-key normalisation ──────────────────────────────────────────────────
// Ensures "Depeche Mode Enjoy The Silence" and "depeche mode enjoy the silence"
// map to the same cache row, improving hit-rate by ~20 %.

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('q');
    if (!raw) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    // Normalised string used as cache key (original preserved for YT search)
    const q = normalizeQuery(raw);

    // Hydrate quota state from DB on cold-start (no-op if already loaded)
    await ensureQuotaLoaded();

    const userKey    = req.headers.get('X-YouTube-Key') || '';
    const serverKeys = getServerKeys();

    const candidates: LabeledKey[] = [
      ...(userKey ? [{ key: userKey, label: 'user' }] : []),
      ...serverKeys.filter(({ key }) => key !== userKey),
    ];

    // Helper: persist a successful result to the cache (non-fatal)
    const cacheResult = async (videoId: string, title: string, thumbnail: string) => {
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
    };

    // ── No keys configured → go straight to free fallback ────────────────────
    if (candidates.length === 0) {
      const fallback = await searchFallback(q);
      if (fallback) {
        await cacheResult(fallback.videoId, fallback.title, fallback.thumbnail);
        return NextResponse.json(fallback);
      }
      return NextResponse.json(
        { error: 'No YouTube API key configured. Add one in Settings or set YOUTUBE_API_KEY_1 in environment variables.' },
        { status: 400 }
      );
    }

    // ── Cache lookup (normalised key) ─────────────────────────────────────────
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

    // ── Try each YouTube API key in order ─────────────────────────────────────
    let lastError = '';

    for (const { key, label } of candidates) {
      if (isExhausted(key)) continue;

      const url =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&maxResults=1&type=video` +
        `&q=${encodeURIComponent(raw)}&key=${key}`;   // raw query for best YT results

      const res = await fetch(url);

      if (!res.ok) {
        const errText = await res.text();

        // Quota exhaustion → mark key, try next
        if (res.status === 403) {
          try {
            const errJson = JSON.parse(errText);
            const reason  = errJson?.error?.errors?.[0]?.reason ?? '';
            if (
              reason === 'quotaExceeded'     ||
              reason === 'dailyLimitExceeded' ||
              reason === 'rateLimitExceeded'
            ) {
              markExhausted(key, label);
              lastError = 'quota exhausted';
              continue;
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

      await cacheResult(videoId, title, thumbnail);
      return NextResponse.json({ videoId, title, thumbnail });
    }

    // ── All YouTube keys exhausted/failed → try free fallback ─────────────────
    const fallback = await searchFallback(q);
    if (fallback) {
      await cacheResult(fallback.videoId, fallback.title, fallback.thumbnail);
      return NextResponse.json(fallback);
    }

    // Nothing worked
    const allExhausted = candidates.every(({ key }) => isExhausted(key));
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
