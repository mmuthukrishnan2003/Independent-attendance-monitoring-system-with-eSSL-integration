const pool = require('../config/db');
const zk = require('../services/zkDeviceService');

async function listDevices(req, res) {
  const result = await pool.query('SELECT * FROM devices ORDER BY name ASC');
  res.json(result.rows);
}

async function getDevice(req, res) {
  const result = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Device not found' });
  res.json(result.rows[0]);
}

/** Re-checks a single device's online/offline status right now (read-only ping via ZK protocol) */
async function checkStatus(req, res) {
  const result = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Device not found' });
  const online = await zk.checkDeviceStatus(result.rows[0]);
  const updated = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  res.json({ online, device: updated.rows[0] });
}

/** Manually trigger a sync/pull for one device, independent of the scheduled poll */
async function syncDevice(req, res) {
  const result = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Device not found' });
  await zk.pollDevice(result.rows[0]);
  const updated = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  res.json({ success: true, device: updated.rows[0] });
}

async function deviceRecords(req, res) {
  const { from, to } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const result = await pool.query(
    `SELECT pl.*, e.full_name, e.employee_code
     FROM punch_logs pl LEFT JOIN employees e ON e.id = pl.employee_id
     WHERE pl.device_id = $1 AND pl.punch_time::date BETWEEN $2 AND $3
     ORDER BY pl.punch_time DESC`,
    [req.params.id, fromDate, toDate]
  );
  res.json(result.rows);
}

async function addDevice(req, res) {
  const { name, ip, port, location } = req.body;
  if (!name || !ip) return res.status(400).json({ error: 'name and ip are required' });
  const device = await zk.upsertDevice({ name, ip, port: port || 4370 });
  if (location) {
    await pool.query('UPDATE devices SET location = $1 WHERE id = $2', [location, device.id]);
  }
  res.status(201).json(device);
}

module.exports = { listDevices, getDevice, checkStatus, syncDevice, deviceRecords, addDevice };
