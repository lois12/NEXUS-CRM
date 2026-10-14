import { register } from '../migrator';
import { run } from '../database';

// Additive only — open-question correct answers
register('028', 'quiz_correct_text', () => {
  run("ALTER TABLE quiz_questions ADD COLUMN correctText TEXT DEFAULT ''", [], true);
});
