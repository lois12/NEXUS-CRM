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

  // Quizzes (public forms)
  run(`CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    organizer TEXT DEFAULT '',
    imageUrl TEXT,
    publicSlug TEXT UNIQUE,
    status TEXT DEFAULT 'draft',
    startsAt TEXT,
    endsAt TEXT,
    afterEndText TEXT DEFAULT '',
    createdBy TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`, [], true);
  run(`CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    quizId TEXT NOT NULL,
    type TEXT DEFAULT 'choice',
    text TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    imageUrl TEXT,
    points INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    correctText TEXT DEFAULT ''
  )`, [], true);
  run(`CREATE TABLE IF NOT EXISTS quiz_options (
    id TEXT PRIMARY KEY,
    questionId TEXT NOT NULL,
    text TEXT DEFAULT '',
    imageUrl TEXT,
    isCorrect INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0
  )`, [], true);
  run(`CREATE TABLE IF NOT EXISTS quiz_participants (
    id TEXT PRIMARY KEY,
    quizId TEXT NOT NULL,
    lastName TEXT DEFAULT '',
    firstName TEXT DEFAULT '',
    patronymic TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    consent INTEGER DEFAULT 0,
    consentAt TEXT,
    consentIp TEXT,
    startedAt TEXT,
    finishedAt TEXT,
    score INTEGER DEFAULT 0,
    totalPoints INTEGER DEFAULT 0,
    durationMs INTEGER DEFAULT 0,
    deviceId TEXT
  )`, [], true);
  run('CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_device ON quiz_participants(quizId, deviceId)', [], true);
  run(`CREATE TABLE IF NOT EXISTS quiz_answers (
    id TEXT PRIMARY KEY,
    participantId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    answerText TEXT DEFAULT '',
    selectedOptionIds TEXT DEFAULT '[]',
    isCorrect INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    answeredAt TEXT
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
