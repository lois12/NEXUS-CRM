import { register } from '../migrator';
import { run } from '../database';

// Additive only - never drops or rewrites columns (VPS DB safety)
// One post = one row; `platforms` is a JSON array of SocialPlatform tags.
// `platform` stays as legacy primary (platforms[0]) for old filters/analytics.
register('022', 'content_platforms', () => {
  run('ALTER TABLE content_posts ADD COLUMN platforms TEXT', [], true);
  // Backfill: platforms = [platform]
  run(`UPDATE content_posts SET platforms = '["' || platform || '"]' WHERE platforms IS NULL AND platform IS NOT NULL`, [], true);
  run(`UPDATE content_posts SET platforms = '["telegram"]' WHERE platforms IS NULL`, [], true);
});
