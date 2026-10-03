import { register } from '../migrator';
import { run } from '../database';

register('009', 'registrations_time_fields', () => {
  run('ALTER TABLE registrations ADD COLUMN registrationStart TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN registrationEnd TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN closedMessage TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN mapCoords TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN showLimit INTEGER DEFAULT 1', [], true);
  run('ALTER TABLE registrations ADD COLUMN showTimer INTEGER DEFAULT 1', [], true);
});

register('010', 'registrations_checkin', () => {
  run('ALTER TABLE registration_submissions ADD COLUMN checkinToken TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN attended INTEGER NOT NULL DEFAULT 0', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN attendedAt TEXT', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN confirmCode TEXT DEFAULT ""', [], true);
});

register('011', 'registrations_fio_split', () => {
  run('ALTER TABLE registration_submissions ADD COLUMN contactLastName TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN contactFirstName TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN contactPatronymic TEXT DEFAULT ""', [], true);
});

register('012', 'registrations_v2', () => {
  run('ALTER TABLE registrations ADD COLUMN organizer TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN color TEXT DEFAULT ""', [], true);
  run('ALTER TABLE registrations ADD COLUMN waitlistEnabled INTEGER DEFAULT 1', [], true);
  run('ALTER TABLE registrations ADD COLUMN maxWaitlist INTEGER DEFAULT 0', [], true);
  run('ALTER TABLE registrations ADD COLUMN theme TEXT DEFAULT "cyberpunk"', [], true);
});