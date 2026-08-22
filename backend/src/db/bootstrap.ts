import fs from 'fs';
import path from 'path';
import { pool } from './pool';

let ready: Promise<void> | null = null;

/**
 * Migration runner shared by `npm run migrate` and the serverless bootstrap.
 *  - 001 creates the base schema and only runs on a fresh database.
 *  - Every later file must be idempotent; the `schema_migrations` ledger skips ones already applied.
 */
export async function runMigrations(log: (m: string) => void = console.log): Promise<{ applied: string[]; fresh: boolean }> {
  const dir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort();
  const [rows]: any = await pool.query("SHOW TABLES LIKE 'users'");
  const fresh = rows.length === 0;
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  const [done]: any = await pool.query('SELECT name FROM schema_migrations');
  const seen = new Set<string>(done.map((r: any) => r.name));
  const applied: string[] = [];
  for (const f of files) {
    if (f.startsWith('001') && !fresh) { if (!seen.has(f)) await pool.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [f]); continue; }
    if (seen.has(f)) continue;
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf-8'));
    await pool.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [f]);
    applied.push(f); log(`[migrate] applied ${f}`);
  }
  return { applied, fresh };
}

/** Serverless bootstrap — single-flight per instance; seeds demo data on a fresh DB when AUTO_SEED=true. */
export function ensureSchema(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const { fresh } = await runMigrations();
    if (fresh && (process.env.AUTO_SEED || '').toLowerCase() === 'true') {
      console.log('[bootstrap] seeding demo data');
      const { runSeed } = await import('./seed');
      await runSeed();
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}
