import { register } from '../migrator';
import { run } from '../database';

// Additive only — никогда не трогаем существующие колонки (VPS DB safety)
register('037', 'conversion_history', () => {
  run(`CREATE TABLE IF NOT EXISTS conv_history (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    toolId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    origName TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  )`, [], true);
  run('CREATE INDEX IF NOT EXISTS idx_conv_history_user_tool ON conv_history(userId, toolId, createdAt)', [], true);
});
