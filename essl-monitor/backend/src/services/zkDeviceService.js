const ZKLib = require('node-zklib');
const pool = require('../config/db');
const { recomputeDailyAttendance } = require('./attendanceService');
const { maybeSendLateEmail } = require('./emailService');

/**
 * IMPORTANT:
 * This service only OPENS A READ CONNECTION to each eSSL/ZKTeco device
 * over the network (standard ZKTeco protocol, port 4370) to pull the
 * attendance log and device info. It never writes to the device, never
 * changes device configuration/users, and never touches the TimeTrack
 * Lite application or its database. Multiple client connections to a
 * ZK device are supported by the device firmware for read operations,
 * so this coexists safely with TimeTrack Lite polling the same device.
 */

async function upsertDevice({ name, ip, port }) {
  const res = await pool.query(
    `INSERT INTO devices (name, ip_address, port)
     VALUES ($1, $2, $3)
     ON CONFLICT (ip_address) DO UPDATE SET name = EXCLUDED.name, port = EXCLUDED.port
     RETURNING *`,
    [name, ip, port]
  );
  return res.rows[0];
}

async function markDeviceStatus(deviceId, status, errorMsg = null) {
  await pool.query(
    `UPDATE devices SET status = $2, last_seen_at = CASE WHEN $2 = 'online' THEN now() ELSE last_seen_at END,
     last_error = $3, updated_at = now() WHERE id = $1`,
    [deviceId, status, errorMsg]
  );
}

async function ensureEmployee(deviceUserId, name) {
  const existing = await pool.query('SELECT * FROM employees WHERE device_user_id = $1', [deviceUserId]);
  if (existing.rows.length) return existing.rows[0];

  const res = await pool.query(
    `INSERT INTO employees (device_user_id, employee_code, full_name)
     VALUES ($1, $1, $2)
     ON CONFLICT (device_user_id) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING *`,
    [deviceUserId, name || `Employee ${deviceUserId}`]
  );
  return res.rows[0];
}

async function checkDeviceStatus(device) {
  const zk = new ZKLib(device.ip_address, device.port, 5200, 5000);
  try {
    await zk.createSocket();
    await markDeviceStatus(device.id, 'online');
    await zk.disconnect();
    return true;
  } catch (err) {
    await markDeviceStatus(device.id, 'offline', err.message);
    return false;
  }
}

async function pollDevice(device) {
  const zk = new ZKLib(device.ip_address, device.port, 10000, 4000);
  const affectedDates = new Set();
  try {
    await zk.createSocket();
    await markDeviceStatus(device.id, 'online');

    // Pull user list (for names) - read only
    let users = [];
    try {
      const userData = await zk.getUsers();
      users = (userData && userData.data) || [];
    } catch (e) {
      console.warn(`[Device:${device.name}] getUsers failed:`, e.message);
    }
    const userMap = new Map(users.map((u) => [String(u.userId ?? u.uid), u.name]));

    // Pull attendance logs - read only
    const logData = await zk.getAttendances();
    const logs = (logData && logData.data) || [];

    for (const log of logs) {
      const deviceUserId = String(log.deviceUserId ?? log.userId ?? log.uid);
      const punchTime = new Date(log.recordTime ?? log.timestamp);
      if (!deviceUserId || isNaN(punchTime.getTime())) continue;

      const employee = await ensureEmployee(deviceUserId, userMap.get(deviceUserId));

      const punchType = inferPunchType(log);

      const inserted = await pool.query(
        `INSERT INTO punch_logs (device_id, device_user_id, employee_id, punch_time, punch_type, verify_mode, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (device_id, device_user_id, punch_time) DO NOTHING
         RETURNING id`,
        [device.id, deviceUserId, employee.id, punchTime.toISOString(), punchType, String(log.verifyMode ?? ''), JSON.stringify(log)]
      );

      if (inserted.rows.length) {
        affectedDates.add(`${employee.id}|${punchTime.toISOString().slice(0, 10)}`);
      }
    }

    await zk.disconnect();
  } catch (err) {
    console.error(`[Device:${device.name}] poll failed:`, err.message);
    await markDeviceStatus(device.id, 'offline', err.message);
    return;
  }

  // Recompute daily summaries + trigger late-email check for affected employee/dates
  for (const key of affectedDates) {
    const [employeeId, dateStr] = key.split('|');
    const summary = await recomputeDailyAttendance(Number(employeeId), dateStr);
    await maybeSendLateEmail(summary);
  }
}

function inferPunchType(log) {
  // Many ZKTeco/eSSL devices report a "state"/"type" field: 0/1 = check-in/out,
  // but this varies by model/firmware. Fall back to UNKNOWN and let the
  // attendance summary logic determine first/last punch regardless.
  if (log.type === 0 || log.state === 0) return 'IN';
  if (log.type === 1 || log.state === 1) return 'OUT';
  return 'UNKNOWN';
}

async function pollAllDevices() {
  const res = await pool.query('SELECT * FROM devices WHERE is_active = true');
  for (const device of res.rows) {
    await pollDevice(device);
  }
}

async function checkAllDeviceStatuses() {
  const res = await pool.query('SELECT * FROM devices WHERE is_active = true');
  for (const device of res.rows) {
    await checkDeviceStatus(device);
  }
}

module.exports = {
  upsertDevice,
  pollDevice,
  pollAllDevices,
  checkDeviceStatus,
  checkAllDeviceStatuses,
};
