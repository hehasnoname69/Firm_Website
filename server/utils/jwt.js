const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'justice-law-firm-dev-secret-change-in-production-2026';

function signClientToken(client) {
  return jwt.sign(
    { sub: client.id, email: client.email, type: 'client', name: `${client.first_name} ${client.last_name}` },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signEmployeeToken(employee) {
  return jwt.sign(
    { sub: employee.id, email: employee.email, type: 'employee', role: employee.role, name: `${employee.first_name} ${employee.last_name}` },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

module.exports = { signClientToken, signEmployeeToken, verifyToken, JWT_SECRET };