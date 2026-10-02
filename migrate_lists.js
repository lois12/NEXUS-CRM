const db = require('./server/dist/db/database');
try { db.run('ALTER TABLE lists ADD COLUMN publicSlug TEXT UNIQUE'); console.log('added publicSlug'); } catch(e) { console.log('publicSlug:', e.message); }
try { db.run('ALTER TABLE lists ADD COLUMN isPublic INTEGER DEFAULT 0'); console.log('added isPublic'); } catch(e) { console.log('isPublic:', e.message); }
process.exit(0);