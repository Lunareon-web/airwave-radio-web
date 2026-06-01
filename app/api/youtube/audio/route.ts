import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns a playable audio URL for a YouTube videoId.
 *
 * Tries Piped instances first (pipedproxy URLs have CORS + Range headers so the
 * browser can play & seek them directly), then falls back to Invidious which
 * rewrites googlevideo URLs through its own /videoplayback proxy.
 *
 * Why native <audio> instead of a youtube.com iframe
 * --------------------------------------------------
 * Chrome Android hard-codes a "YouTube" media-notification layout for any
 * youtube.com iframe that produces audio.  That layout shows only [⏸] + seek
 * bar and silently ignores setActionHandler('nexttrack') registrations.
 * A native <audio> element on the main page makes OUR page the audio owner so
 * Chrome uses our full Media Session ([⏮][⏸][⏭]) on the lock screen and
 * forwards hardware media keys (keyboard / Bluetooth) to our handlers.
 */

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://piped-api.codeberg.page',
];

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://yt.artemislena.eu',
  'https://invidious.tiekoetter.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacydev.net',
];

interface AudioResult {
  url:       string;
  mimeType:  string;
  duration?: number;
}

// ── Piped ─────────────────────────────────────────────────────────────────────

async function tryPiped(instance: string, videoId: string): Promise<AudioResult> {
  const res = await fetch(`${instance}/streams/${encodeURIComponent(videoId)}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    audioStreams?: Array<{ url?: string; mimeType?: string; bitrate?: number }>;
    duration?:     number;
  };

  const streams = (data.audioStreams ?? []).filter(s => s.url && s.mimeType);
  if (!streams.length) throw new Error('no audioStreams');

  const best =
    streams.find(s => s.mimeType?.startsWith('audio/mp4'))   ??
    streams.find(s => s.mimeType?.includes('opus'))          ??
    streams[0];

  console.log(`[audio] Piped hit (${instance})`);
  return {
    url:      best.url!,
    mimeType: (best.mimeType ?? 'audio/mp4').split(';')[0],
    duration: typeof data.duration === 'number' ? data.duration : undefined,
  };
}

// ── Invidious ─────────────────────────────────────────────────────────────────

async function tryInvidious(instance: string, videoId: string): Promise<AudioResult> {
  const res = await fetch(
    `${instance}/api/v1/videos/${encodeURIComponent(videoId)}` +
    `?fields=adaptiveFormats,lengthSeconds`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    adaptiveFormats?: Array<{ url?: string; type?: string; bitrate?: number }>;
    lengthSeconds?:   number;
  };

  const formats = (data.adaptiveFormats ?? []).filter(f => f.url && f.type?.startsWith('audio/'));
  if (!formats.length) throw new Error('no audio formats');

  const best =
    formats.find(f => f.type?.startsWith('audio/mp4')) ??
    formats.find(f => f.type?.includes('opus'))        ??
    formats[0];

  // Rewrite direct googlevideo URL → same Invidious instance's /videoplayback proxy.
  // The googlevideo URL is authenticated to Invidious's server IP; routing it
  // back through the same instance avoids the IP-mismatch 403.
  const originalUrl = new URL(best.url!);
  const proxiedUrl  = `${instance}/videoplayback${originalUrl.search}`;

  console.log(`[audio] Invidious hit (${instance})`);
  return {
    url:      proxiedUrl,
    mimeType: (best.type ?? 'audio/mp4').split(';')[0],
    duration: typeof data.lengthSeconds === 'number' ? data.lengthSeconds : undefined,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

  try {
    const result = await Promise.any([
      ...PIPED_INSTANCES.map(i => tryPiped(i, videoId)),
      ...INVIDIOUS_INSTANCES.map(i => tryInvidious(i, videoId)),
    ]);

    return NextResponse.json(result, {
      headers: {
        // URLs expire in ~6 h — cache for 2 h with comfortable headroom.
        // The _retry query param added on client retries bypasses this cache.
        'Cache-Control': 'public, max-age=7200',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'All audio sources failed' },
      { status: 503 }
    );
  }
}
