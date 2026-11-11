import { register } from '../migrator';
import { run } from '../database';

// Показывать карту на публичной форме — опционально
register('035', 'registrations_show_map', () => {
  run('ALTER TABLE registrations ADD COLUMN showMap INTEGER DEFAULT 1', [], true);
});
