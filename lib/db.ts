import { neon, Pool, neonConfig } from '@neondatabase/serverless';

// HTTP driver — used for all regular query/tagged-template calls in API routes.
// Works in Vercel Edge & Node runtimes without WebSocket setup.
export const sql = neon(process.env.NEON_DATABASE_URL!);

// WebSocket pool — used when raw SQL strings need to be executed (e.g. DDL migration).
// In production (Vercel/Node) ws is needed; in Next.js edge runtime this is skipped.
let _pool: Pool | null = null;
export function getPool(): Pool {
  if (!_pool) {
    if (typeof WebSocket === 'undefined') {
      // Node.js runtime: wire up the ws package
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      neonConfig.webSocketConstructor = require('ws');
    }
    _pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL! });
  }
  return _pool;
}
