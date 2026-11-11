import { register } from '../migrator';
import { run } from '../database';

// Контроль посещения (QR-проходка) — опционально для каждой регистрации
// NB: id must be unique across all migrations (033 was already taken by 025)
register('034', 'registrations_checkin_enabled', () => {
  run('ALTER TABLE registrations ADD COLUMN checkinEnabled INTEGER DEFAULT 1', [], true);
});
