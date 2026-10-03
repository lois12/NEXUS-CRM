import { register } from '../migrator';
import { run } from '../database';

register('001', 'user_profile_fields', () => {
  run('ALTER TABLE users ADD COLUMN roles TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN position TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN about TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN status TEXT DEFAULT ""', [], true);
  run('ALTER TABLE users ADD COLUMN socialLinks TEXT DEFAULT "{}"', [], true);
  run('ALTER TABLE users ADD COLUMN lastSeen TEXT', [], true);
});