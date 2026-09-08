import path from 'path';
import fs from 'fs';

// Detect if running from compiled dist/ or tsx source
// tsx: __dirname = server/...  →  compiled: __dirname = server/dist/...
const inDist = __dirname.endsWith(`${path.sep}dist`) || __dirname.includes(`${path.sep}dist${path.sep}`);

// Project root (where client/, server/, uploads/ live)
export const PROJECT_ROOT = inDist
  ? path.resolve(__dirname, '..', '..')  // server/dist/../../
  : path.resolve(__dirname, '..');        // server/../

// Server directory
export const SERVER_DIR = path.join(PROJECT_ROOT, 'server');

// Data directory (Docker volume or local server/)
const DATA_DIR = process.env.DATA_DIR || SERVER_DIR;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Common paths
export const DB_PATH = path.join(DATA_DIR, 'nexus.db');
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? process.env.UPLOADS_DIR
  : path.join(PROJECT_ROOT, 'uploads');
export const MODELS_DIR = path.join(SERVER_DIR, 'models');
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');

// .env priority: server/.env > root/.env
export const ENV_PATH = fs.existsSync(path.join(SERVER_DIR, '.env'))
  ? path.join(SERVER_DIR, '.env')
  : path.join(PROJECT_ROOT, '.env');
