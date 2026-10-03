import { register } from '../migrator';
import { run } from '../database';

register('013', 'widgets_features', () => {
  run('ALTER TABLE widgets ADD COLUMN customSlug TEXT DEFAULT ""', [], true);
  run('ALTER TABLE widgets ADD COLUMN password TEXT DEFAULT ""', [], true);
  run('ALTER TABLE widgets ADD COLUMN viewCount INTEGER DEFAULT 0', [], true);
  run('ALTER TABLE widgets ADD COLUMN category TEXT DEFAULT ""', [], true);
  run('ALTER TABLE widgets ADD COLUMN isPinned INTEGER DEFAULT 0', [], true);
  run('ALTER TABLE widgets ADD COLUMN folder TEXT DEFAULT ""', [], true);
});

register('014', 'lists_public', () => {
  run('ALTER TABLE lists ADD COLUMN publicSlug TEXT UNIQUE', [], true);
  run('ALTER TABLE lists ADD COLUMN isPublic INTEGER DEFAULT 0', [], true);
});