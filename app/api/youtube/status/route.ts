import { NextResponse } from 'next/server';
import { ensureQuotaLoaded, getKeyStatus } from '@/lib/youtube-quota';

/**
 * GET /api/youtube/status
 *
 * Returns the quota health of all configured server-side YouTube API keys.
 * No raw key data is ever exposed — only masked suffixes and SHA-256 hashes.
 *
 * Example response:
 * {
 *   "keys": [
 *     { "label": "KEY_1", "suffix": "...abc123", "hash": "a1b2c3d4e5f60123", "status": "available" },
 *     { "label": "KEY_2", "suffix": "...def456", "hash": "...", "status": "exhausted",
 *       "exhaustedAt": "2024-05-28T10:00:00Z", "resetsAt": "2024-05-29T10:00:00Z" }
 *   ],
 *   "available": 1,
 *   "total": 2
 * }
 */
export async function GET() {
  // Ensure DB-persisted quota records are loaded (no-op if already done)
  await ensureQuotaLoaded();

  const keys      = getKeyStatus();
  const available = keys.filter((k) => k.status === 'available').length;

  return NextResponse.json({
    keys,
    available,
    total: keys.length,
  });
}
