import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('018', 'collage_projects', () => {
  run(`CREATE TABLE IF NOT EXISTS collage_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    ownerId TEXT,
    ownerName TEXT DEFAULT '',
    pageCount INTEGER DEFAULT 1,
    pagesJson TEXT NOT NULL DEFAULT '[]',
    imagesJson TEXT NOT NULL DEFAULT '[]',
    versionsJson TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`);
  run('CREATE INDEX IF NOT EXISTS idx_collage_projects_owner ON collage_projects(ownerId)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_collage_projects_updated ON collage_projects(updatedAt)', [], true);
});
