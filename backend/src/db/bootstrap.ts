import fs from 'fs';
import path from 'path';
import { pool } from './pool';

let ready: Promise<void> | null = null;

/**
 * Serverless-friendly schema bootstrap: on first request, if the schema is missing,
 * apply migrations/*.sql and (optionally) the seed. Idempotent and single-flight per instance.
 * Enable with AUTO_MIGRATE=true (and AUTO_SEED=true for demo data).
 */
export function ensureSchema(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const dir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort();
    const [rows]: any = await pool.query("SHOW TABLES LIKE 'users'");
    const fresh = rows.length === 0;
    if (fresh) console.log('[bootstrap] schema missing — applying migrations');
    for (const f of files) {
      // 001 creates the base schema (not idempotent) — only on a fresh DB.
      // Later migrations must be idempotent (CREATE TABLE IF NOT EXISTS …) and are always applied.
      if (f.startsWith('001') && !fresh) continue;
      await pool.query(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (fresh || !f.startsWith('001')) console.log(`[bootstrap] applied ${f}`);
    }
    if (!fresh) return;
    if ((process.env.AUTO_SEED || '').toLowerCase() === 'true') {
      console.log('[bootstrap] seeding demo data');
      const { runSeed } = await import('./seed');
      await runSeed();
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}
