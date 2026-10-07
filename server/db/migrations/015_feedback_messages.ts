import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('023', 'feedback_messages', () => {
  run(`CREATE TABLE IF NOT EXISTS feedback_messages (
    id TEXT PRIMARY KEY,
    userId TEXT,
    userName TEXT DEFAULT '',
    message TEXT NOT NULL,
    page TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    createdAt TEXT DEFAULT (datetime('now')),
    resolvedAt TEXT
  )`, [], true);
  run('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_messages(status)', [], true);
});
