const pool = require('../config/db');

async function listEmployees(req, res) {
  const { department, status, search } = req.query;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (department) { conditions.push(`department = $${idx++}`); params.push(department); }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
  if (search) { conditions.push(`(full_name ILIKE $${idx} OR employee_code ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM employees ${where} ORDER BY full_name ASC`, params);
  res.json(result.rows);
}

async function getEmployee(req, res) {
  const result = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
  res.json(result.rows[0]);
}

async function updateEmployee(req, res) {
  const { full_name, department, designation, email, phone, photo_url, date_joined, status, employee_code } = req.body;
  const result = await pool.query(
    `UPDATE employees SET
       full_name = COALESCE($2, full_name),
       department = COALESCE($3, department),
       designation = COALESCE($4, designation),
       email = COALESCE($5, email),
       phone = COALESCE($6, phone),
       photo_url = COALESCE($7, photo_url),
       date_joined = COALESCE($8, date_joined),
       status = COALESCE($9, status),
       employee_code = COALESCE($10, employee_code),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, full_name, department, designation, email, phone, photo_url, date_joined, status, employee_code]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
  res.json(result.rows[0]);
}

async function employeeHistory(req, res) {
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const result = await pool.query(
    `SELECT * FROM daily_attendance WHERE employee_id = $1 AND attendance_date BETWEEN $2 AND $3
     ORDER BY attendance_date DESC`,
    [req.params.id, fromDate, toDate]
  );
  res.json(result.rows);
}

async function employeePunches(req, res) {
  const { from, to } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const result = await pool.query(
    `SELECT pl.*, d.name AS device_name, d.ip_address
     FROM punch_logs pl JOIN devices d ON d.id = pl.device_id
     WHERE pl.employee_id = $1 AND pl.punch_time::date BETWEEN $2 AND $3
     ORDER BY pl.punch_time DESC`,
    [req.params.id, fromDate, toDate]
  );
  res.json(result.rows);
}

module.exports = { listEmployees, getEmployee, updateEmployee, employeeHistory, employeePunches };
