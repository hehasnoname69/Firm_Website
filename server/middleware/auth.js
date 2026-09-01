const { verifyToken } = require('../utils/jwt');

function getToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.cookies?.client_token) return req.cookies.client_token;
  if (req.cookies?.employee_token) return req.cookies.employee_token;
  return null;
}

function requireClient(req, res, next) {
  const token = getToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.type !== 'client') {
    if (req.accepts('html')) return res.redirect('/auth/login.html');
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = payload;
  next();
}

function requireEmployee(req, res, next) {
  const token = getToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.type !== 'employee') {
    if (req.accepts('html')) return res.redirect('/auth/employee-login.html');
    return res.status(401).json({ error: 'Employee authentication required' });
  }
  req.user = payload;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function attachUserIfPresent(req, res, next) {
  const token = getToken(req);
  const payload = token ? verifyToken(token) : null;
  if (payload) req.user = payload;
  next();
}

module.exports = { requireClient, requireEmployee, requireRole, attachUserIfPresent, getToken };