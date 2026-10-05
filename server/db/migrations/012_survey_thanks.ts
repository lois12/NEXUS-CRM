import { register } from '../migrator';
import { run } from '../database';

// Additive only — never touches existing tables (VPS DB safety)
register('020', 'survey_thanks', () => {
  run("ALTER TABLE surveys ADD COLUMN thanksText TEXT DEFAULT ''", [], true);
  run("ALTER TABLE surveys ADD COLUMN thanksRedirectUrl TEXT DEFAULT ''", [], true);
});
