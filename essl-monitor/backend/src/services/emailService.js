const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { getSetting } = require('./settingsService');

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function logEmail({ type, recipient, subject, employeeId, success, error }) {
  await pool.query(
    `INSERT INTO email_log (type, recipient, subject, employee_id, success, error)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [type, recipient, subject, employeeId || null, success, error || null]
  );
}

async function sendMail({ to, subject, html, type, employeeId }) {
  if (!to) return;
  const transport = buildTransport();
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    await logEmail({ type, recipient: to, subject, employeeId, success: true });
  } catch (err) {
    console.error('[Email] send failed:', err.message);
    await logEmail({ type, recipient: to, subject, employeeId, success: false, error: err.message });
  }
}

/**
 * Called after a daily_attendance row is recomputed for "today".
 * Sends a late-arrival email once per employee per day, only if enabled.
 */
async function maybeSendLateEmail(summary) {
  if (!summary) return;
  const enabled = (await getSetting('late_email_enabled', 'true')) === 'true';
  if (!enabled) return;
  if (!summary.is_late) return;
  if (summary.late_email_sent) return;

  const today = new Date().toISOString().slice(0, 10);
  if (String(summary.attendance_date).slice(0, 10) !== today) return; // only alert for today, not historical recompute

  if (!summary.email) return;

  const subject = `Late Arrival Alert - ${summary.full_name}`;
  const html = `
    <p>Dear Admin,</p>
    <p><b>${summary.full_name}</b> (${summary.employee_code || ''}, ${summary.department || 'N/A'})
       checked in late today by <b>${summary.late_by_minutes} minutes</b>.</p>
    <p>First punch: ${new Date(summary.first_punch_in).toLocaleString()}</p>
    <p>This is an automated message from the Attendance Monitoring System.</p>
  `;

  const recipients = await getSetting('daily_report_recipients', process.env.DAILY_REPORT_RECIPIENTS || '');
  const to = [summary.email, ...(recipients ? recipients.split(',') : [])].filter(Boolean).join(',');

  await sendMail({ to, subject, html, type: 'LATE_ALERT', employeeId: summary.employee_id });

  await pool.query(
    `UPDATE daily_attendance SET late_email_sent = true WHERE employee_id = $1 AND attendance_date = $2`,
    [summary.employee_id, summary.attendance_date]
  );
}

/** Sends the automatic daily working report (all employees) if enabled. */
async function sendDailyWorkingReport(dateStr) {
  const enabled = (await getSetting('daily_report_email_enabled', 'true')) === 'true';
  if (!enabled) return { sent: false, reason: 'disabled' };

  const res = await pool.query(
    `SELECT da.*, e.full_name, e.employee_code, e.department
     FROM daily_attendance da JOIN employees e ON e.id = da.employee_id
     WHERE da.attendance_date = $1
     ORDER BY e.full_name ASC`,
    [dateStr]
  );

  const rows = res.rows.map((r) => `
    <tr>
      <td>${r.full_name}</td>
      <td>${r.employee_code || ''}</td>
      <td>${r.department || ''}</td>
      <td>${r.status}</td>
      <td>${r.first_punch_in ? new Date(r.first_punch_in).toLocaleTimeString() : '-'}</td>
      <td>${r.last_punch_out ? new Date(r.last_punch_out).toLocaleTimeString() : '-'}</td>
      <td>${(r.total_seconds / 3600).toFixed(2)} hrs</td>
      <td>${r.is_late ? 'Yes (' + r.late_by_minutes + ' min)' : 'No'}</td>
    </tr>`).join('');

  const html = `
    <h3>Daily Working Report - ${dateStr}</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <tr style="background:#f0f0f0">
        <th>Employee</th><th>Code</th><th>Department</th><th>Status</th>
        <th>First In</th><th>Last Out</th><th>Total Hours</th><th>Late</th>
      </tr>
      ${rows}
    </table>
    <p>Automated report from Attendance Monitoring System.</p>
  `;

  const recipients = await getSetting('daily_report_recipients', process.env.DAILY_REPORT_RECIPIENTS || '');
  if (!recipients) return { sent: false, reason: 'no recipients configured' };

  await sendMail({
    to: recipients,
    subject: `Daily Attendance Working Report - ${dateStr}`,
    html,
    type: 'DAILY_REPORT',
  });

  return { sent: true };
}

module.exports = { sendMail, maybeSendLateEmail, sendDailyWorkingReport };
