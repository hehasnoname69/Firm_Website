const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { signClientToken, signEmployeeToken } = require('../utils/jwt');
const { requireClient, requireEmployee } = require('../middleware/auth');

const router = express.Router();

const VALID_ROLES = ['admin', 'attorney', 'paralegal', 'receptionist', 'investigator'];
const VALID_SERVICES = ['Family Law', 'Personal Injury', 'Real Estate Law', 'Immigration Law',
                        'Intellectual Property', 'Civil Law', 'Asset Recovery', 'Corporate Law'];

router.post('/signup', (req, res) => {
  const { first_name, last_name, email, password, phone } = req.body || {};
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM clients WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#c9a84c', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const info = db.prepare(`INSERT INTO clients (first_name, last_name, email, password_hash, phone, avatar_color)
                           VALUES (?, ?, ?, ?, ?, ?)`)
    .run(first_name.trim(), last_name.trim(), cleanEmail, hash, phone || null, color);

  const client = db.prepare('SELECT id, first_name, last_name, email, avatar_color FROM clients WHERE id = ?').get(info.lastInsertRowid);
  const token = signClientToken(client);
  res.cookie('client_token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ token, client });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const cleanEmail = String(email).trim().toLowerCase();
  const client = db.prepare('SELECT * FROM clients WHERE email = ?').get(cleanEmail);
  if (!client) return res.status(401).json({ error: 'Invalid email or password.' });
  if (client.status !== 'active') return res.status(403).json({ error: 'This account is not active.' });

  const ok = bcrypt.compareSync(password, client.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  db.prepare('UPDATE clients SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(client.id);
  const safe = { id: client.id, first_name: client.first_name, last_name: client.last_name,
                 email: client.email, phone: client.phone, avatar_color: client.avatar_color };
  const token = signClientToken(client);
  res.cookie('client_token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ token, client: safe });
});

router.post('/employee/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const cleanEmail = String(email).trim().toLowerCase();
  const employee = db.prepare('SELECT * FROM employees WHERE email = ?').get(cleanEmail);
  if (!employee) return res.status(401).json({ error: 'Invalid email or password.' });
  if (employee.status !== 'active') return res.status(403).json({ error: 'This account is disabled.' });

  const ok = bcrypt.compareSync(password, employee.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  db.prepare('UPDATE employees SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(employee.id);
  const safe = { id: employee.id, first_name: employee.first_name, last_name: employee.last_name,
                 email: employee.email, role: employee.role, title: employee.title, department: employee.department,
                 avatar_color: employee.avatar_color };
  const token = signEmployeeToken(employee);
  res.cookie('employee_token', token, { httpOnly: true, maxAge: 8*60*60*1000, sameSite: 'lax' });
  res.json({ token, employee: safe });
});

router.get('/me', (req, res) => {
  const { getToken } = require('../middleware/auth');
  const { verifyToken } = require('../utils/jwt');
  const token = getToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  if (payload.type === 'client') {
    const client = db.prepare(`SELECT id, first_name, last_name, email, phone, address, city, state, zip, country,
                                      notification_email, notification_sms, avatar_color, created_at
                               FROM clients WHERE id = ?`).get(payload.sub);
    if (!client) return res.status(404).json({ error: 'Account not found' });
    return res.json({ type: 'client', user: client });
  }
  if (payload.type === 'employee') {
    const employee = db.prepare(`SELECT id, first_name, last_name, email, role, title, department, phone, avatar_color, created_at
                                 FROM employees WHERE id = ?`).get(payload.sub);
    if (!employee) return res.status(404).json({ error: 'Account not found' });
    return res.json({ type: 'employee', user: employee });
  }
  res.status(401).json({ error: 'Invalid token' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('client_token');
  res.clearCookie('employee_token');
  res.json({ ok: true });
});

module.exports = router;