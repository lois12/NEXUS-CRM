import { register } from '../migrator';
import { run } from '../database';

// Additive only — knowledge article image thumbs + deep links
register('026', 'knowledge_thumbs', () => {
  run('ALTER TABLE knowledge_attachments ADD COLUMN thumbnailUrl TEXT', [], true);
});
