import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('021', 'survey_status', () => {
  run("ALTER TABLE surveys ADD COLUMN status TEXT DEFAULT 'draft'", [], true);
  run("ALTER TABLE surveys ADD COLUMN opensAt TEXT", [], true);
  run("ALTER TABLE surveys ADD COLUMN closedAt TEXT", [], true);
  // legacy: already-published surveys become status=published
  run("UPDATE surveys SET status = 'published' WHERE isPublic = 1", [], true);
  run('CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status)', [], true);
});
