import fs from 'fs';
import path from 'path';
import { backupDatabase, get, run } from '../db/database';
import { DB_BACKUP_DIR } from '../paths';

/**
 * Daily automatic DB backup — 09:00 server-local time.
 * Runs inside the Node process (no crontab edit needed on VPS).
 * Files: nexus_auto_YYYY-MM-DD.db in DB_BACKUP_DIR. Keeps last 30.
 */

const RETENTION_DAYS = 30;
const LAST_DAY_KEY = 'autoBackupLastDay';

function ensureDir(): string {
  if (!fs.existsSync(DB_BACKUP_DIR)) fs.mkdirSync(DB_BACKUP_DIR, { recursive: true });
  return DB_BACKUP_DIR;
}

function localDayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function cleanupOld(): void {
  const dir = ensureDir();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(dir)) {
    if (!/^nexus_auto_\d{4}-\d{2}-\d{2}(_\d{2}-\d{2})?\.db$/.test(f)) continue;
    const st = fs.statSync(path.join(dir, f));
    if (st.mtimeMs < cutoff) {
      try { fs.unlinkSync(path.join(dir, f)); } catch { /* keep going */ }
    }
  }
}

export async function runDailyBackup(): Promise<{ name: string; size: number } | null> {
  const day = localDayKey();
  const row = get('SELECT value FROM app_settings WHERE key = ?', [LAST_DAY_KEY]);
  if (row?.value === day) return null; // already done today

  const dir = ensureDir();
  const name = `nexus_auto_${day}.db`;
  const dest = path.join(dir, name);
  await backupDatabase(dest);

  // verify SQLite header (never keep a corrupt file)
  const fd = fs.openSync(dest, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);
  if (!head.toString('utf8').startsWith('SQLite format')) {
    try { fs.unlinkSync(dest); } catch { /* ignore */ }
    throw new Error('auto backup corrupt (no SQLite header)');
  }

  run(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')`,
    [LAST_DAY_KEY, day],
  );
  cleanupOld();
  return { name, size: fs.statSync(dest).size };
}

export function startAutoBackup(): void {
  const tick = () => {
    const now = new Date();
    // 09:00–09:01 server-local, once per day
    if (now.getHours() !== 9 || now.getMinutes() > 1) return;
    runDailyBackup()
      .then((r) => {
        if (r) console.log(`[auto-backup] ${r.name} (${r.size} bytes)`);
      })
      .catch((e) => console.error('[auto-backup] failed:', e?.message || e));
  };
  setInterval(tick, 60_000);
  // fire once shortly after boot if today's backup is missing (covers restarts / deploys after 09:00)
  setTimeout(() => {
    const now = new Date();
    if (now.getHours() >= 9) {
      runDailyBackup()
        .then((r) => { if (r) console.log(`[auto-backup] catch-up ${r.name}`); })
        .catch((e) => console.error('[auto-backup] catch-up failed:', e?.message || e));
    }
  }, 15_000);
}

export function getAutoBackupStatus(): { lastDay: string | null; nextAt: string } {
  const row = get('SELECT value FROM app_settings WHERE key = ?', [LAST_DAY_KEY]);
  return {
    lastDay: row?.value || null,
    nextAt: 'каждый день в 09:00 (время сервера)',
  };
}
