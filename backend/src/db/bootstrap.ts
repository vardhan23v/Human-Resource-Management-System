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
    const [rows]: any = await pool.query("SHOW TABLES LIKE 'users'");
    if (rows.length) return;
    console.log('[bootstrap] schema missing — applying migrations');
    const dir = path.join(__dirname, '../../migrations');
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) {
      await pool.query(fs.readFileSync(path.join(dir, f), 'utf-8'));
      console.log(`[bootstrap] applied ${f}`);
    }
    if ((process.env.AUTO_SEED || '').toLowerCase() === 'true') {
      console.log('[bootstrap] seeding demo data');
      const { runSeed } = await import('./seed');
      await runSeed();
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}
