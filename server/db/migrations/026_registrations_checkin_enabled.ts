import { register } from '../migrator';
import { run } from '../database';

// Контроль посещения (QR-проходка) — опционально для каждой регистрации
register('033', 'registrations_checkin_enabled', () => {
  run('ALTER TABLE registrations ADD COLUMN checkinEnabled INTEGER DEFAULT 1', [], true);
});
