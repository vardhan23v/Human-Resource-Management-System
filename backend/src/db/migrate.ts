import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const dir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    const conn = await pool.getConnection();
    try {
      // split by ; but keep simple: mysql2 can handle multipleStatements? use query per file via conn.query
      await conn.query(sql);
      console.log(`✓ ${file}`);
    } finally {
      conn.release();
    }
  }
  console.log('All migrations applied');
  process.exit(0);
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
