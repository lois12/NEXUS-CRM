import { register } from '../migrator';
import { run } from '../database';

register('015', 'app_settings_control_password', () => {
  run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now'))
  )`);
});
