import { runMigrations } from './bootstrap';

runMigrations().then(r => {
  console.log(r.applied.length ? `Applied ${r.applied.length} migration(s)` : 'Schema up to date');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
