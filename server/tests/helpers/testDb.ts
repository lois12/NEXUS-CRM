import bcrypt from 'bcryptjs';
import { initDatabase, run, get } from '../../db/database';
import { initializeDatabase } from '../../db/init';

export const TEST_ADMIN_ID = 'test-admin-id';
export const TEST_ADMIN_USER = 'testadmin';
export const TEST_ADMIN_PASS = 'test123';

/**
 * Fresh in-memory DB + schema + seed users for a test file.
 * Call once in beforeAll() of every *.test.ts that touches the database.
 */
export function setupTestDb(): void {
  initDatabase(true);
  initializeDatabase();

  // Common ALTER columns from migrations (vitest can't runMigrations — circular import)
  run('ALTER TABLE content_posts ADD COLUMN platforms TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN scheduledAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN approvedAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN finalizedAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN rejectionReason TEXT DEFAULT ""', [], true);
  run('ALTER TABLE content_posts ADD COLUMN thumbnailUrl TEXT', [], true);
  run('ALTER TABLE users ADD COLUMN lastSeen TEXT', [], true);
  run('ALTER TABLE users ADD COLUMN roles TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN position TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN about TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN status TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN avatar TEXT', [], true);
  run('ALTER TABLE users ADD COLUMN socialLinks TEXT', [], true);

  // Tables created by migrations (not present in init.ts CREATE TABLE)
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
  )`, [], true);

  seedTestUsers();
}

/** Seed the users every test suite expects (testadmin / test-admin-id). */
export function seedTestUsers(): void {
  const existing = get('SELECT id FROM users WHERE id = ?', [TEST_ADMIN_ID]);
  if (existing) return;

  const hash = bcrypt.hashSync(TEST_ADMIN_PASS, 10);
  run(
    `INSERT INTO users (id, username, password, email, fullName, role, roles)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [TEST_ADMIN_ID, TEST_ADMIN_USER, hash, 'test@nexus.ru', 'Test Admin', 'руководитель', 'руководитель,smm']
  );

  // Second user — many list endpoints expect >= 2
  const second = get('SELECT id FROM users WHERE username = ?', ['testuser2']);
  if (!second) {
    const hash2 = bcrypt.hashSync(TEST_ADMIN_PASS, 10);
    run(
      `INSERT INTO users (id, username, password, email, fullName, role, roles)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['test-user-2', 'testuser2', hash2, 'test2@test.local', 'Test User Two', 'редактор', 'редактор']
    );
  }

  // Editor used by vacations / ownership tests
  const editor = get('SELECT id FROM users WHERE id = ?', ['test-editor-id']);
  if (!editor) {
    const hash3 = bcrypt.hashSync(TEST_ADMIN_PASS, 10);
    run(
      `INSERT INTO users (id, username, password, email, fullName, role, roles)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['test-editor-id', 'testeditor', hash3, 'editor@test.local', 'Test Editor', 'редактор', 'редактор']
    );
  }
}

/** Standard admin JWT payload used across API tests. */
export function adminTokenPayload() {
  return {
    id: TEST_ADMIN_ID,
    username: TEST_ADMIN_USER,
    role: 'руководитель' as const,
    roles: ['руководитель', 'smm', 'редактор'],
  };
}
