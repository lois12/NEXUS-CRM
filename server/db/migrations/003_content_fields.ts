import { register } from '../migrator';
import { run } from '../database';

register('005', 'content_approval', () => {
  run('ALTER TABLE content_posts ADD COLUMN scheduledAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN approvedAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN finalizedAt TEXT', [], true);
  run('ALTER TABLE content_posts ADD COLUMN rejectionReason TEXT DEFAULT ""', [], true);
});

register('006', 'content_thumbnails', () => {
  run('ALTER TABLE content_posts ADD COLUMN thumbnailUrl TEXT', [], true);
  run('ALTER TABLE project_documents ADD COLUMN thumbnailPath TEXT', [], true);
});