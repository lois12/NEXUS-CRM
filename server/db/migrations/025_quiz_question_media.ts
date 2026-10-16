import { register } from '../migrator';
import { run } from '../database';

// Additive only — видео/аудио в вопросе квиза
register('033', 'quiz_question_media', () => {
  run('ALTER TABLE quiz_questions ADD COLUMN videoUrl TEXT', [], true);
  run('ALTER TABLE quiz_questions ADD COLUMN audioUrl TEXT', [], true);
});