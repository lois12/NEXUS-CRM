import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import { DB_PATH } from '../paths';

const dbPath = DB_PATH;

let db: SqlJsDatabase;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 500; // ms

// Initialize database
export async function initDatabase(testMode = false): Promise<void> {
  const SQL = await initSqlJs();
  
  if (testMode) {
    db = new SQL.Database();
  } else if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign key constraints (sqlite default is OFF)
  db.run('PRAGMA foreign_keys = ON');
}

// Debounced save — batches writes every 500ms
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) {
      flushNow();
    }
  }, FLUSH_INTERVAL);
}

function flushNow() {
  if (!db || !dirty) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    dirty = false;
  } catch (err) {
    console.error('DB flush error:', err);
  }
}

// Force save — call on shutdown / process exit
export function saveDatabase(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushNow();
}

// Execute a query and return results
export function query(sql: string, params: any[] = []): any[] {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Execute a statement (INSERT, UPDATE, DELETE)
export function run(sql: string, params: any[] = [], silent: boolean = false): void {
  try {
    db.run(sql, params);
    dirty = true;
    scheduleFlush();
  } catch (error) {
    if (!silent) console.error('Run error:', error);
    throw error;
  }
}

// Get a single row
export function get(sql: string, params: any[] = []): any | null {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Get the database instance
export function getDb(): SqlJsDatabase {
  return db;
}

// Flush on process exit
process.on('SIGINT', () => { saveDatabase(); process.exit(0); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(0); });
process.on('exit', () => { saveDatabase(); });

export default { initDatabase, saveDatabase, query, run, get, getDb };
