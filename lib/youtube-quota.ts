/**
 * YouTube API quota tracker — DB-persisted so it survives Vercel cold-starts.
 *
 * Each API key is identified only by a truncated SHA-256 hash (never stored raw).
 * Exhaustion records live in `youtube_quota_log` (Neon PostgreSQL) and are loaded
 * into an in-process Map on first use.  Subsequent requests within the same
 * process instance skip the DB round-trip.
 */

import { createHash } from 'crypto';
import { sql } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabeledKey {
  key: string;
  label: string;
}

export interface KeyStatus {
  label: string;
  /** Last 6 characters of the raw key — safe to display, never the full key. */
  suffix: string;
  hash: string;
  status: 'available' | 'exhausted';
  exhaustedAt?: string;  // ISO 8601
  resetsAt?: string;     // ISO 8601
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTA_RESET_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── In-process state ─────────────────────────────────────────────────────────

/** hash → Unix timestamp (ms) when marked exhausted */
const quotaExhaustedAt = new Map<string, number>();

let dbLoaded = false;
let dbLoadPromise: Promise<void> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable 16-char identifier derived from the raw key. Never the key itself. */
export function keyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// ─── DB bootstrap ─────────────────────────────────────────────────────────────

/**
 * Called once per process: creates the table if needed and hydrates the
 * in-memory Map from still-valid DB records.
 * Safe to await on every request — resolves instantly after first call.
 */
export async function ensureQuotaLoaded(): Promise<void> {
  if (dbLoaded) return;
  if (dbLoadPromise) return dbLoadPromise;

  dbLoadPromise = (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS youtube_quota_log (
          key_hash     TEXT PRIMARY KEY,
          key_label    TEXT NOT NULL,
          exhausted_at TIMESTAMPTZ NOT NULL
        )
      `;

      const rows = await sql`
        SELECT key_hash, exhausted_at
        FROM youtube_quota_log
        WHERE exhausted_at > NOW() - INTERVAL '24 hours'
      `;

      for (const row of rows) {
        const ms = new Date(row.exhausted_at as string).getTime();
        quotaExhaustedAt.set(row.key_hash as string, ms);
      }

      dbLoaded = true;
    } catch (err) {
      console.error('[youtube-quota] DB load failed — falling back to in-process only:', err);
      // Allow retry on next request
      dbLoadPromise = null;
    }
  })();

  return dbLoadPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the key's daily quota is exhausted.
 * Auto-clears stale entries (> 24 h old).
 */
export function isExhausted(key: string): boolean {
  const hash = keyHash(key);
  const ts = quotaExhaustedAt.get(hash);
  if (!ts) return false;
  if (Date.now() - ts > QUOTA_RESET_MS) {
    quotaExhaustedAt.delete(hash);
    return false;
  }
  return true;
}

/**
 * Marks a key as exhausted in-memory AND persists to DB (fire-and-forget).
 */
export function markExhausted(key: string, label: string): void {
  const hash = keyHash(key);
  const now  = Date.now();
  console.warn(`[youtube] Key ${label} (...${key.slice(-6)}) quota exhausted — switching to next key`);
  quotaExhaustedAt.set(hash, now);

  // Persist — non-blocking, errors are logged but don't fail the request
  sql`
    INSERT INTO youtube_quota_log (key_hash, key_label, exhausted_at)
    VALUES (${hash}, ${label}, NOW())
    ON CONFLICT (key_hash) DO UPDATE
      SET key_label    = ${label},
          exhausted_at = NOW()
  `.catch((err) => console.error('[youtube-quota] DB write failed:', err));
}

/**
 * Clears exhaustion for a given hash (admin / manual reset).
 * Also removes the DB record.
 */
export async function resetKey(hash: string): Promise<void> {
  quotaExhaustedAt.delete(hash);
  await sql`DELETE FROM youtube_quota_log WHERE key_hash = ${hash}`;
}

// ─── Key collection ───────────────────────────────────────────────────────────

/**
 * Returns all configured server-side keys with stable labels.
 * Never leaks raw keys to the client.
 */
export function getServerKeys(): LabeledKey[] {
  const keys: LabeledKey[] = [];
  const seen = new Set<string>();

  for (let i = 1; i <= 9; i++) {
    const k = process.env[`YOUTUBE_API_KEY_${i}`];
    if (k && !seen.has(k)) {
      seen.add(k);
      keys.push({ key: k, label: `KEY_${i}` });
    }
  }

  // Backward-compat: plain YOUTUBE_API_KEY
  const legacy = process.env.YOUTUBE_API_KEY;
  if (legacy && !seen.has(legacy)) {
    keys.push({ key: legacy, label: 'KEY' });
  }

  return keys;
}

/**
 * Returns sanitised status for every configured server key.
 * Safe to return in a public API response (no raw key data).
 */
export function getKeyStatus(): KeyStatus[] {
  const serverKeys = getServerKeys();
  const now = Date.now();

  return serverKeys.map(({ key, label }) => {
    const hash = keyHash(key);
    const ts   = quotaExhaustedAt.get(hash);

    if (ts && now - ts <= QUOTA_RESET_MS) {
      return {
        label,
        suffix:      `...${key.slice(-6)}`,
        hash,
        status:      'exhausted' as const,
        exhaustedAt: new Date(ts).toISOString(),
        resetsAt:    new Date(ts + QUOTA_RESET_MS).toISOString(),
      };
    }

    return {
      label,
      suffix: `...${key.slice(-6)}`,
      hash,
      status: 'available' as const,
    };
  });
}
