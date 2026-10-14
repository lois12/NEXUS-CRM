import { register } from '../migrator';
import { run } from '../database';

// Additive only — quizzes module
register('027', 'quizzes', () => {
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
    type TEXT NOT NULL DEFAULT 'choice',
    text TEXT NOT NULL,
    imageUrl TEXT,
    points INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    correctText TEXT DEFAULT ''
  )`, [], true);
  run('ALTER TABLE quiz_questions ADD COLUMN correctText TEXT DEFAULT \'\'', [], true);

  run(`CREATE TABLE IF NOT EXISTS quiz_options (
    id TEXT PRIMARY KEY,
    questionId TEXT NOT NULL,
    text TEXT NOT NULL,
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
    consent INTEGER DEFAULT 1,
    consentAt TEXT,
    consentIp TEXT,
    startedAt TEXT,
    finishedAt TEXT,
    score REAL DEFAULT 0,
    totalPoints REAL DEFAULT 0,
    durationMs INTEGER DEFAULT 0
  )`, [], true);

  run(`CREATE TABLE IF NOT EXISTS quiz_answers (
    id TEXT PRIMARY KEY,
    participantId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    answerText TEXT DEFAULT '',
    selectedOptionIds TEXT DEFAULT '[]',
    isCorrect INTEGER DEFAULT 0,
    points REAL DEFAULT 0,
    answeredAt TEXT DEFAULT (datetime('now'))
  )`, [], true);

  run('CREATE INDEX IF NOT EXISTS idx_quiz_q ON quiz_questions(quizId)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_quiz_opt ON quiz_options(questionId)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_quiz_part ON quiz_participants(quizId)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_quiz_ans ON quiz_answers(participantId)', [], true);
});
