import { register } from '../migrator';
import { run } from '../database';

// Additive only — никогда не трогаем существующие колонки (VPS DB safety)
register('036', 'survey_closes_at', () => {
  run('ALTER TABLE surveys ADD COLUMN closesAt TEXT', [], true);
});
