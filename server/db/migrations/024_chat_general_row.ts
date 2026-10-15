import { register } from '../migrator';
import { run } from '../database';

// Общий чат: строка в chat_conversations (FK для messages/reads/mutes/pins)
register('032', 'chat_general_row', () => {
  run(`INSERT OR IGNORE INTO users (id, username, password, email, fullName, role, roles)
       VALUES ('system', 'system', '!', 'system@nexus.local', 'Система', 'super_admin', 'super_admin')`, [], true);
  run(`INSERT OR IGNORE INTO chat_conversations (id, type, name, user1Id, user2Id, lastMessagePreview)
       VALUES ('general', 'general', 'Общий чат', 'system', 'system', '')`, [], true);
});
