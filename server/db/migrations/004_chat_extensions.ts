import { register } from '../migrator';
import { run } from '../database';

register('007', 'chat_conversations_v2', () => {
  run('ALTER TABLE chat_conversations ADD COLUMN type TEXT NOT NULL DEFAULT "private"', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN name TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN avatar TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN description TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN inviteLink TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0', [], true);
  run('ALTER TABLE chat_conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0', [], true);
});

register('008', 'chat_messages_v2', () => {
  run('ALTER TABLE chat_messages ADD COLUMN editedAt TEXT', [], true);
  run('ALTER TABLE chat_messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0', [], true);
  run('ALTER TABLE chat_messages ADD COLUMN forwardedFrom TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_messages ADD COLUMN caption TEXT DEFAULT ""', [], true);
  run('ALTER TABLE chat_messages ADD COLUMN transcript TEXT DEFAULT ""', [], true);
});