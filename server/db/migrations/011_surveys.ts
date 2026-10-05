import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('019', 'surveys', () => {
  run(`CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    imageUrl TEXT DEFAULT '',
    isAnonymous INTEGER NOT NULL DEFAULT 0,
    publicSlug TEXT UNIQUE,
    isPublic INTEGER NOT NULL DEFAULT 0,
    createdBy TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS survey_questions (
    id TEXT PRIMARY KEY,
    surveyId TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'choice',
    title TEXT NOT NULL,
    options TEXT DEFAULT '[]',
    required INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (surveyId) REFERENCES surveys(id) ON DELETE CASCADE
  )`);

  run(`CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    surveyId TEXT NOT NULL,
    deviceId TEXT NOT NULL DEFAULT '',
    userId TEXT,
    contactName TEXT DEFAULT '',
    contactPhone TEXT DEFAULT '',
    contactEmail TEXT DEFAULT '',
    answers TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (surveyId) REFERENCES surveys(id) ON DELETE CASCADE,
    UNIQUE(surveyId, deviceId)
  )`);

  run('CREATE INDEX IF NOT EXISTS idx_survey_questions ON survey_questions(surveyId, position)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_survey_responses ON survey_responses(surveyId)', [], true);
  run('CREATE INDEX IF NOT EXISTS idx_surveys_slug ON surveys(publicSlug)', [], true);
});
