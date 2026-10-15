import { register } from '../migrator';
import { run } from '../database';

// Additive only — comment/hint under the question
register('030', 'quiz_question_comment', () => {
  run("ALTER TABLE quiz_questions ADD COLUMN comment TEXT DEFAULT ''", [], true);
});
