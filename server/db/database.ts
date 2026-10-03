import Database from 'better-sqlite3';
import fs from 'fs';
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

// Execute a query and return results
export function query(sql: string, params: any[] = []): any[] {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as any[];
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Execute a statement (INSERT, UPDATE, DELETE)
export function run(sql: string, params: any[] = [], silent: boolean = false): void {
  try {
    const stmt = db.prepare(sql);
    stmt.run(...params);
  } catch (error) {
    if (!silent) console.error('Run error:', error);
    throw error;
  }
}

// Get a single row
export function get(sql: string, params: any[] = []): any | null {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
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

export default { initDatabase, saveDatabase, query, run, get, getDb };