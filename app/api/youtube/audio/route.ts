import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns a playable audio URL for a YouTube videoId.
 *
 * STATUS (2025-06): This route is currently not called by the main player.
 * YTPlayer uses the YouTube iframe for both video and audio modes because:
 *   - Piped instances are mostly shut down / returning 403
 *   - Invidious instances block server-to-server API requests
 *   - YouTube now requires a PO Token for all server-side stream extraction,
 *     blocking ytdl-core / youtubei.js from cloud provider IPs (Vercel)
 *
 * Kept here as a scaffold to re-enable native <audio> mode if a reliable
 * proxy source becomes available again in the future.
 *
 * Media Session (prev/next on lockscreen) is maintained via
 *   Permissions-Policy: mediasession=(self)   (next.config.ts)
 * which blocks the cross-origin YouTube iframe from overriding our handlers.
 */

// ── Piped ──────────────────────────────────────────────────────────────────────
const PIPED_INSTANCES = [
  'https://piped.video',
  'https://pipedapi.drgns.space',
  'https://piped-api.garudalinux.org',
];

// ── Invidious ──────────────────────────────────────────────────────────────────
const INVIDIOUS_INSTANCES = [
  'https://invidious.privacyredirect.com',
  'https://invidious.perennialte.ch',
  'https://iv.nboeck.de',
];

interface AudioResult {
  url:       string;
  mimeType:  string;
  duration?: number;
}

async function tryPiped(instance: string, videoId: string): Promise<AudioResult> {
  const res = await fetch(`${instance}/streams/${encodeURIComponent(videoId)}`, {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('non-JSON (probably a challenge page)');
  const data = await res.json() as {
    audioStreams?: Array<{ url?: string; mimeType?: string; bitrate?: number }>;
    duration?: number;
  };
  const streams = (data.audioStreams ?? []).filter(s => s.url);
  if (!streams.length) throw new Error('no audioStreams');
  const best =
    streams.find(s => s.mimeType?.startsWith('audio/mp4')) ??
    streams.find(s => s.mimeType?.includes('opus')) ??
    streams[0];
  console.log(`[audio] Piped hit ${instance}`);
  return { url: best.url!, mimeType: (best.mimeType ?? 'audio/mp4').split(';')[0], duration: typeof data.duration === 'number' ? data.duration : undefined };
}

async function tryInvidious(instance: string, videoId: string): Promise<AudioResult> {
  const res = await fetch(
    `${instance}/api/v1/videos/${encodeURIComponent(videoId)}?fields=adaptiveFormats,lengthSeconds`,
    { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    adaptiveFormats?: Array<{ url?: string; type?: string; bitrate?: number }>;
    lengthSeconds?: number;
  };
  const formats = (data.adaptiveFormats ?? []).filter(f => f.url && f.type?.startsWith('audio/'));
  if (!formats.length) throw new Error('no audio formats');
  const best =
    formats.find(f => f.type?.startsWith('audio/mp4')) ??
    formats.find(f => f.type?.includes('opus')) ??
    formats[0];
  const originalUrl = new URL(best.url!);
  const proxiedUrl  = `${instance}/videoplayback${originalUrl.search}`;
  console.log(`[audio] Invidious hit ${instance}`);
  return { url: proxiedUrl, mimeType: (best.type ?? 'audio/mp4').split(';')[0], duration: typeof data.lengthSeconds === 'number' ? data.lengthSeconds : undefined };
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

  try {
    const result = await Promise.any([
      ...PIPED_INSTANCES.map(i => tryPiped(i, videoId)),
      ...INVIDIOUS_INSTANCES.map(i => tryInvidious(i, videoId)),
    ]);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=7200' } });
  } catch {
    return NextResponse.json({ error: 'All audio sources failed' }, { status: 503 });
  }
}
