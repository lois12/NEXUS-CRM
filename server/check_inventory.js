const initSqlJs = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('G:\\CRT THE NEXUS CRM\\server\\nexus.db');
  const db = new SQL.Database(buf);

  // Check if inventory table exists
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory';");
  console.log('Inventory table exists:', tables[0]?.values?.length > 0);

  // Get inventory schema
  const schema = db.exec("PRAGMA table_info(inventory);");
  console.log('Inventory schema:', JSON.stringify(schema, null, 2));

  // Check inventory data
  const data = db.exec("SELECT * FROM inventory LIMIT 5;");
  console.log('Inventory data:', JSON.stringify(data, null, 2));

  db.close();
})();
