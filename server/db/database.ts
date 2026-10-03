import Database from 'better-sqlite3';
import { DB_PATH } from '../paths';

let db: Database.Database;

// Initialize database
export function initDatabase(testMode = false): void {
  if (testMode) {
    db = new Database(':memory:');
  } else {
    db = new Database(DB_PATH);
    // Enable WAL mode — allows concurrent readers with a single writer,
    // better crash recovery than default journal mode
    db.pragma('journal_mode = WAL');
  }

  // Enable foreign key constraints (sqlite default is OFF)
  db.pragma('foreign_keys = ON');
  // Busy timeout — wait up to 5s if the DB is locked by another writer
  db.pragma('busy_timeout = 5000');
}

// Execute a query and return rows. Pass a type param for typed results: query<User>(...)
// Default is `any` for gradual typing — existing call sites stay valid.
export function query<T = any>(sql: string, params: any[] = []): T[] {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Execute a statement (INSERT, UPDATE, DELETE)
export function run(sql: string, params: any[] = [], silent = false): void {
  try {
    const stmt = db.prepare(sql);
    stmt.run(...params);
  } catch (error: any) {
    if (!silent) console.error('Run error:', error);
    if (!silent) throw error;
  }
}

// Get a single row. Pass a type param for typed results: get<User>(...)
export function get<T = any>(sql: string, params: any[] = []): T | null {
  try {
    const stmt = db.prepare(sql);
    return (stmt.get(...params) as T | undefined) || null;
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
}

/**
 * Run multiple statements inside a single transaction.
 * Rolls back everything on any throw — safe for multi-row writes
 * (duplicate registration, kanban reorder, notification fan-out, etc.).
 */
export function transaction(fn: () => void): void {
  const trx = db.transaction(fn);
  trx();
}

// Get the database instance
export function getDb(): Database.Database {
  return db;
}

// Graceful shutdown — WAL checkpoint + close
export function saveDatabase(): void {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  }
}

// Flush on process exit
process.on('SIGINT', () => { saveDatabase(); process.exit(0); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(0); });
process.on('exit', () => { try { saveDatabase(); } catch {} });

export default { initDatabase, saveDatabase, query, run, get, transaction, getDb };
