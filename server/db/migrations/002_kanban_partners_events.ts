import { register } from '../migrator';
import { run } from '../database';

register('002', 'kanban_archive', () => {
  run('ALTER TABLE kanban_tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0', [], true);
});

register('003', 'partners_category', () => {
  run('ALTER TABLE partners ADD COLUMN category TEXT DEFAULT ""', [], true);
});

register('004', 'events_projects_images', () => {
  run('ALTER TABLE events ADD COLUMN imageUrl TEXT DEFAULT ""', [], true);
  run('ALTER TABLE projects ADD COLUMN imageUrl TEXT DEFAULT ""', [], true);
});