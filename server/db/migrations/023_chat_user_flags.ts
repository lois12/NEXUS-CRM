import { register } from '../migrator';
import { run } from '../database';

// Per-user pin / archive for conversations (was global on chat_conversations)
register('031', 'chat_user_flags', () => {
  run(`CREATE TABLE IF NOT EXISTS chat_user_flags (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    UNIQUE(conversationId, userId)
  )`, [], true);
  run('CREATE INDEX IF NOT EXISTS idx_chat_uf_flags ON chat_user_flags(userId, conversationId)', [], true);
});
