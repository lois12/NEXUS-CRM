import { register } from '../migrator';
import { run } from '../database';

// Additive only
register('029', 'quiz_device', () => {
  run('ALTER TABLE quiz_participants ADD COLUMN deviceId TEXT', [], true);
  run('CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_device ON quiz_participants(quizId, deviceId)', [], true);
});
