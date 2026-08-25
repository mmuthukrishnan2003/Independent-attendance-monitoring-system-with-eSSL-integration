const pool = require('../config/db');

async function attendanceRange({ from, to, employeeId, department }) {
  const conditions = ['da.attendance_date BETWEEN $1 AND $2'];
  const params = [from, to];
  let idx = 3;

  if (employeeId) {
    conditions.push(`da.employee_id = $${idx++}`);
    params.push(employeeId);
  }
  if (department) {
    conditions.push(`e.department = $${idx++}`);
    params.push(department);
  }

  const sql = `
    SELECT da.*, e.full_name, e.employee_code, e.department, e.designation
    FROM daily_attendance da
    JOIN employees e ON e.id = da.employee_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY da.attendance_date ASC, e.full_name ASC
  `;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function lateArrivals({ from, to }) {
  const res = await pool.query(
    `SELECT da.*, e.full_name, e.employee_code, e.department
     FROM daily_attendance da JOIN employees e ON e.id = da.employee_id
     WHERE da.attendance_date BETWEEN $1 AND $2 AND da.is_late = true
     ORDER BY da.attendance_date DESC, da.late_by_minutes DESC`,
    [from, to]
  );
  return res.rows;
}

async function earlyDepartures({ from, to }) {
  const res = await pool.query(
    `SELECT da.*, e.full_name, e.employee_code, e.department
     FROM daily_attendance da JOIN employees e ON e.id = da.employee_id
     WHERE da.attendance_date BETWEEN $1 AND $2 AND da.is_early_departure = true
     ORDER BY da.attendance_date DESC, da.early_by_minutes DESC`,
    [from, to]
  );
  return res.rows;
}

async function overtimeReport({ from, to }) {
  const res = await pool.query(
    `SELECT da.*, e.full_name, e.employee_code, e.department
     FROM daily_attendance da JOIN employees e ON e.id = da.employee_id
     WHERE da.attendance_date BETWEEN $1 AND $2 AND da.overtime_seconds > 0
     ORDER BY da.attendance_date DESC, da.overtime_seconds DESC`,
    [from, to]
  );
  return res.rows;
}

async function deviceWiseReport({ from, to, deviceId }) {
  const conditions = ['pl.punch_time::date BETWEEN $1 AND $2'];
  const params = [from, to];
  let idx = 3;
  if (deviceId) {
    conditions.push(`pl.device_id = $${idx++}`);
    params.push(deviceId);
  }
  const sql = `
    SELECT d.name AS device_name, d.ip_address, pl.device_user_id, e.full_name,
           pl.punch_time, pl.punch_type
    FROM punch_logs pl
    JOIN devices d ON d.id = pl.device_id
    LEFT JOIN employees e ON e.id = pl.employee_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY pl.punch_time DESC
  `;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function totalWorkingHoursReport({ from, to, employeeId }) {
  const conditions = ['da.attendance_date BETWEEN $1 AND $2'];
  const params = [from, to];
  let idx = 3;
  if (employeeId) {
    conditions.push(`da.employee_id = $${idx++}`);
    params.push(employeeId);
  }
  const sql = `
    SELECT e.id AS employee_id, e.full_name, e.employee_code, e.department,
           SUM(da.total_seconds) AS total_seconds,
           SUM(da.overtime_seconds) AS overtime_seconds,
           COUNT(*) FILTER (WHERE da.status = 'PRESENT') AS present_days,
           COUNT(*) FILTER (WHERE da.status = 'ABSENT') AS absent_days,
           COUNT(*) FILTER (WHERE da.is_late) AS late_days
    FROM daily_attendance da
    JOIN employees e ON e.id = da.employee_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY e.id, e.full_name, e.employee_code, e.department
    ORDER BY e.full_name ASC
  `;
  const res = await pool.query(sql, params);
  return res.rows;
}

module.exports = {
  attendanceRange,
  lateArrivals,
  earlyDepartures,
  overtimeReport,
  deviceWiseReport,
  totalWorkingHoursReport,
};
