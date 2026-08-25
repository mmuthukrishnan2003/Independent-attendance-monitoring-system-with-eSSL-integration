const pool = require('../config/db');

async function getSetting(key, fallback = null) {
  const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  if (!res.rows.length) return fallback;
  return res.rows[0].value;
}

async function getAllSettings() {
  const res = await pool.query('SELECT key, value FROM settings ORDER BY key');
  const out = {};
  for (const row of res.rows) out[row.key] = row.value;
  return out;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, String(value)]
  );
}

module.exports = { getSetting, getAllSettings, setSetting };
