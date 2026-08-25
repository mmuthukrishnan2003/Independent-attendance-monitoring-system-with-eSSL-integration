const pool = require('../config/db');
const { getSetting } = require('./settingsService');

/**
 * Recomputes the daily_attendance summary row for one employee/date
 * from the raw punch_logs. First punch of the day = IN, last punch = OUT.
 * Total working duration = last punch - first punch (in seconds).
 */
async function recomputeDailyAttendance(employeeId, dateStr) {
  const punchesRes = await pool.query(
    `SELECT punch_time FROM punch_logs
     WHERE employee_id = $1 AND punch_time::date = $2::date
     ORDER BY punch_time ASC`,
    [employeeId, dateStr]
  );
  const punches = punchesRes.rows.map((r) => new Date(r.punch_time));

  if (!punches.length) {
    await pool.query(
      `INSERT INTO daily_attendance (employee_id, attendance_date, status)
       VALUES ($1, $2, 'ABSENT')
       ON CONFLICT (employee_id, attendance_date)
       DO UPDATE SET status = 'ABSENT', first_punch_in = NULL, last_punch_out = NULL, total_seconds = 0, updated_at = now()`,
      [employeeId, dateStr]
    );
    return getDailySummary(employeeId, dateStr);
  }

  const firstIn = punches[0];
  const lastOut = punches[punches.length - 1];
  const totalSeconds = Math.max(0, Math.round((lastOut - firstIn) / 1000));

  const officeStart = await getSetting('office_start_time', '09:30');
  const graceMinutes = Number(await getSetting('late_grace_minutes', '10'));
  const standardHours = Number(await getSetting('standard_work_hours', '8'));

  const [oh, om] = officeStart.split(':').map(Number);
  const scheduledStart = new Date(firstIn);
  scheduledStart.setHours(oh, om, 0, 0);
  const lateByMinutes = Math.max(0, Math.round((firstIn - scheduledStart) / 60000) - graceMinutes);
  const isLate = lateByMinutes > 0;

  const standardSeconds = standardHours * 3600;
  const overtimeSeconds = Math.max(0, totalSeconds - standardSeconds);

  const scheduledEnd = new Date(scheduledStart.getTime() + standardSeconds * 1000);
  const earlyByMinutes = punches.length > 1 && lastOut < scheduledEnd
    ? Math.round((scheduledEnd - lastOut) / 60000)
    : 0;
  const isEarlyDeparture = earlyByMinutes > 0;

  const status = punches.length >= 2 ? 'PRESENT' : 'HALF_DAY';

  await pool.query(
    `INSERT INTO daily_attendance
      (employee_id, attendance_date, first_punch_in, last_punch_out, total_seconds, status,
       is_late, late_by_minutes, is_early_departure, early_by_minutes, overtime_seconds, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
       first_punch_in = EXCLUDED.first_punch_in,
       last_punch_out = EXCLUDED.last_punch_out,
       total_seconds = EXCLUDED.total_seconds,
       status = EXCLUDED.status,
       is_late = EXCLUDED.is_late,
       late_by_minutes = EXCLUDED.late_by_minutes,
       is_early_departure = EXCLUDED.is_early_departure,
       early_by_minutes = EXCLUDED.early_by_minutes,
       overtime_seconds = EXCLUDED.overtime_seconds,
       updated_at = now()`,
    [employeeId, dateStr, firstIn.toISOString(), lastOut.toISOString(), totalSeconds, status,
      isLate, lateByMinutes, isEarlyDeparture, earlyByMinutes, overtimeSeconds]
  );

  return getDailySummary(employeeId, dateStr);
}

async function getDailySummary(employeeId, dateStr) {
  const res = await pool.query(
    `SELECT da.*, e.full_name, e.employee_code, e.email, e.department
     FROM daily_attendance da JOIN employees e ON e.id = da.employee_id
     WHERE da.employee_id = $1 AND da.attendance_date = $2`,
    [employeeId, dateStr]
  );
  return res.rows[0];
}

/** Marks ABSENT rows for all active employees who have zero punches on a given date. Run once/day (e.g. end of day) via scheduler. */
async function markAbsentees(dateStr) {
  await pool.query(
    `INSERT INTO daily_attendance (employee_id, attendance_date, status)
     SELECT e.id, $1::date, 'ABSENT'
     FROM employees e
     WHERE e.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM daily_attendance da WHERE da.employee_id = e.id AND da.attendance_date = $1::date
       )
     ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
    [dateStr]
  );
}

module.exports = { recomputeDailyAttendance, getDailySummary, markAbsentees };
