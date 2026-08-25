const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('[Migrate] Applying schema to database:', process.env.PGDATABASE);
  try {
    await pool.query(sql);
    console.log('[Migrate] Done. Tables created/verified successfully.');
  } catch (err) {
    console.error('[Migrate] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
