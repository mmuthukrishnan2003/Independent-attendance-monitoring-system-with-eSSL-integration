const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Usage: node src/db/seedAdmin.js <username> <password>
async function seed() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [username, hash]
    );
    console.log(`[Seed] Admin user ready -> username: ${username}, password: ${password}`);
    console.log('[Seed] IMPORTANT: change this password after first login.');
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
