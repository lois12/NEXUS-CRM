import { register } from '../migrator';
import { run } from '../database';

// Additive only — image thumbnails for materials grid (perf on weak PCs)
register('025', 'material_thumbs', () => {
  run('ALTER TABLE materials ADD COLUMN thumbnailUrl TEXT', [], true);
});
