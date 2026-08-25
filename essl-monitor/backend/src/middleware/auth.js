const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username, role, employeeId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Restrict route to given roles, e.g. requireRole('admin') or requireRole('admin','manager') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

/** For "user" role: only allow access to their own employee_id-scoped data */
function scopeToSelfUnlessAdmin(paramName = 'employeeId') {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'manager') return next();
    const requested = req.params[paramName] || req.query[paramName];
    if (String(req.user.employeeId) !== String(requested)) {
      return res.status(403).json({ error: 'You can only view your own attendance data' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, scopeToSelfUnlessAdmin };
