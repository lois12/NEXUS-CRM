import { register } from '../migrator';
import { run } from '../database';

register('016', 'chat_hidden_per_user', () => {
  run(`CREATE TABLE IF NOT EXISTS chat_hidden (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    UNIQUE(conversationId, userId)
  )`);
});
