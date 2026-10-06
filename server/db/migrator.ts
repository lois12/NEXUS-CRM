import { run, query } from './database';

interface Migration {
  id: string;
  name: string;
  up: () => void;
}

const migrations: Migration[] = [];

export function register(id: string, name: string, fn: () => void) {
  migrations.push({ id, name, up: fn });
}

// ── Register all migrations ──
import './migrations/001_user_profile_fields';
import './migrations/002_kanban_partners_events';
import './migrations/003_content_fields';
import './migrations/004_chat_extensions';
import './migrations/005_registrations';
import './migrations/006_widgets_lists';
import './migrations/007_control_password';
import './migrations/008_chat_hidden';
import './migrations/009_short_links';
import './migrations/010_collage_projects';
import './migrations/011_surveys';
import './migrations/012_survey_thanks';
import './migrations/013_survey_status';
import './migrations/014_content_platforms';

export function runMigrations(): void {
  run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  migrations.sort((a, b) => a.id.localeCompare(b.id));

  const applied = new Set(
    query('SELECT id FROM schema_migrations').map(r => r.id)
  );

  let count = 0;
  for (const m of migrations) {
    if (applied.has(m.id)) continue;

    console.log(`  Migration ${m.id} — ${m.name}`);
    try {
      m.up();
      run('INSERT INTO schema_migrations (id, name) VALUES (?, ?)', [m.id, m.name]);
      count++;
    } catch (err) {
      console.error(`  Migration ${m.id} FAILED:`, err);
      throw err;
    }
  }

  if (count > 0) {
    console.log(`Applied ${count} migration(s)`);
  }
}