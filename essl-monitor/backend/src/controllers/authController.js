const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const result = await pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, employeeId: user.employee_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, employeeId: user.employee_id } });
}

async function me(req, res) {
  res.json({ user: req.user });
}

/** Admin creates a new portal user account (optionally linked to an employee for "user" role) */
async function createUser(req, res) {
  const { username, password, role, employeeId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, employee_id)
       VALUES ($1,$2,$3,$4) RETURNING id, username, role, employee_id`,
      [username, hash, role || 'user', employeeId || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
}

async function listUsers(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.role, u.is_active, u.employee_id, e.full_name
     FROM users u LEFT JOIN employees e ON e.id = u.employee_id ORDER BY u.id`
  );
  res.json(result.rows);
}

async function changePassword(req, res) {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  res.json({ success: true });
}

module.exports = { login, me, createUser, listUsers, changePassword };
