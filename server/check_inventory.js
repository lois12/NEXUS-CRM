const Database = require('better-sqlite3');

const db = new Database('G:\\CRT THE NEXUS CRM\\server\\nexus.db', { readonly: true });

// Check if inventory table exists
const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory'").get();
console.log('Inventory table exists:', !!table);

// Get inventory schema
const schema = db.prepare("PRAGMA table_info(inventory)").all();
console.log('Inventory schema:', JSON.stringify(schema, null, 2));

// Check inventory data
const data = db.prepare("SELECT * FROM inventory LIMIT 5").all();
console.log('Inventory data:', JSON.stringify(data, null, 2));

db.close();