import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('017', 'short_links', () => {
  run(`CREATE TABLE IF NOT EXISTS short_links (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    createdBy TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  )`);
  run('CREATE INDEX IF NOT EXISTS idx_short_links_creator ON short_links(createdBy)', [], true);
});
