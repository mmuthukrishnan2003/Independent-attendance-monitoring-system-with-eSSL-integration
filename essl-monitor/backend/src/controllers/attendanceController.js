const pool = require('../config/db');

/** Live "today" board: every active employee with their current status */
async function todayBoard(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code, e.department, e.designation, e.photo_url,
            da.first_punch_in, da.last_punch_out, da.total_seconds, da.status, da.is_late, da.late_by_minutes
     FROM employees e
     LEFT JOIN daily_attendance da ON da.employee_id = e.id AND da.attendance_date = $1
     WHERE e.status = 'active'
     ORDER BY e.full_name ASC`,
    [today]
  );
  res.json({ date: today, employees: result.rows });
}

/** Live recent punch feed (most recent N punches across all devices) */
async function recentPunches(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const result = await pool.query(
    `SELECT pl.id, pl.punch_time, pl.punch_type, e.full_name, e.employee_code, d.name AS device_name, d.ip_address
     FROM punch_logs pl
     LEFT JOIN employees e ON e.id = pl.employee_id
     JOIN devices d ON d.id = pl.device_id
     ORDER BY pl.punch_time DESC
     LIMIT $1`,
    [limit]
  );
  res.json(result.rows);
}

async function dailyStatus(req, res) {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code, e.department,
            COALESCE(da.status, 'ABSENT') AS status, da.first_punch_in, da.last_punch_out,
            da.total_seconds, da.is_late, da.late_by_minutes
     FROM employees e
     LEFT JOIN daily_attendance da ON da.employee_id = e.id AND da.attendance_date = $1
     WHERE e.status = 'active'
     ORDER BY e.full_name ASC`,
    [date]
  );
  res.json({ date, employees: result.rows });
}

module.exports = { todayBoard, recentPunches, dailyStatus };
