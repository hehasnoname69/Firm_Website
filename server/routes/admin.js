const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { requireEmployee, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/employees', requireEmployee, requireRole('admin'), (req, res) => {
  const employees = db.prepare(`SELECT id, first_name, last_name, email, role, title, department, phone, status, created_at, last_login
                                FROM employees ORDER BY role, last_name`).all();
  res.json({ employees });
});

router.post('/employees', requireEmployee, requireRole('admin'), (req, res) => {
  const { first_name, last_name, email, password, role, title, department, phone } = req.body || {};
  if (!first_name || !last_name || !email || !password || !role) return res.status(400).json({ error: 'Missing required fields.' });
  if (!['admin','attorney','paralegal','receptionist','investigator'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM employees WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'Email already in use.' });

  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#c9a84c', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const info = db.prepare(`INSERT INTO employees (first_name, last_name, email, password_hash, role, title, department, phone, avatar_color)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(first_name.trim(), last_name.trim(), cleanEmail, hash, role, title || null, department || null, phone || null, color);

  const employee = db.prepare(`SELECT id, first_name, last_name, email, role, title, department, phone, status FROM employees WHERE id=?`).get(info.lastInsertRowid);
  res.json({ employee });
});

router.put('/employees/:id', requireEmployee, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const { first_name, last_name, email, role, title, department, phone, status, password } = req.body || {};
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!emp) return res.status(404).json({ error: 'Employee not found.' });

  const updates = [];
  const params = [];
  if (first_name !== undefined) { updates.push('first_name=?'); params.push(first_name); }
  if (last_name !== undefined) { updates.push('last_name=?'); params.push(last_name); }
  if (email !== undefined) { updates.push('email=?'); params.push(String(email).trim().toLowerCase()); }
  if (role !== undefined) {
    if (!['admin','attorney','paralegal','receptionist','investigator'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    updates.push('role=?'); params.push(role);
  }
  if (title !== undefined) { updates.push('title=?'); params.push(title); }
  if (department !== undefined) { updates.push('department=?'); params.push(department); }
  if (phone !== undefined) { updates.push('phone=?'); params.push(phone); }
  if (status !== undefined) {
    if (!['active','disabled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    updates.push('status=?'); params.push(status);
  }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    updates.push('password_hash=?'); params.push(bcrypt.hashSync(password, 10));
  }
  if (updates.length === 0) return res.json({ ok: true });
  params.push(id);
  db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id=?`).run(...params);
  res.json({ ok: true });
});

router.delete('/employees/:id', requireEmployee, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.sub) return res.status(400).json({ error: 'You cannot disable your own account.' });
  db.prepare(`UPDATE employees SET status='disabled' WHERE id=?`).run(id);
  res.json({ ok: true });
});

router.get('/clients', requireEmployee, requireRole('admin', 'receptionist'), (req, res) => {
  const clients = db.prepare(`SELECT id, first_name, last_name, email, phone, status, created_at, last_login
                              FROM clients ORDER BY created_at DESC`).all();
  res.json({ clients });
});

router.put('/clients/:id/status', requireEmployee, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body || {};
  if (!['active','suspended','closed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare(`UPDATE clients SET status=? WHERE id=?`).run(status, id);
  res.json({ ok: true });
});

router.get('/cms/practice-areas', (req, res) => {
  const areas = db.prepare(`SELECT * FROM practice_areas ORDER BY display_order`).all();
  res.json({ areas });
});

router.get('/analytics', requireEmployee, requireRole('admin'), (req, res) => {
  const totalClients = db.prepare(`SELECT COUNT(*) AS c FROM clients`).get().c;
  const totalEmployees = db.prepare(`SELECT COUNT(*) AS c FROM employees WHERE status='active'`).get().c;
  const activeCases = db.prepare(`SELECT COUNT(*) AS c FROM cases WHERE status NOT IN ('closed','won','lost')`).get().c;
  const closedCases = db.prepare(`SELECT COUNT(*) AS c FROM cases WHERE status IN ('closed','won','lost')`).get().c;
  const openTickets = db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE status NOT IN ('resolved','closed')`).get().c;
  const arCases = db.prepare(`SELECT COUNT(*) AS c FROM asset_recovery_cases`).get().c;
  const arRecovered = db.prepare(`SELECT COUNT(*) AS c FROM asset_recovery_cases WHERE intake_status='recovered'`).get().c;
  const revenue = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS paid,
    COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END),0) AS due
    FROM invoices`).get();

  const monthlyCases = db.prepare(`
    SELECT strftime('%Y-%m', opened_at) AS month, COUNT(*) AS count
    FROM cases WHERE opened_at >= date('now','-6 months')
    GROUP BY month ORDER BY month`).all();
  const monthlyConsults = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
    FROM consultations WHERE created_at >= date('now','-6 months')
    GROUP BY month ORDER BY month`).all();
  const ticketsByStatus = db.prepare(`SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`).all();
  const casesByService = db.prepare(`SELECT service_category, COUNT(*) AS count FROM cases GROUP BY service_category ORDER BY count DESC`).all();
  const arByStatus = db.prepare(`SELECT intake_status AS status, COUNT(*) AS count FROM asset_recovery_cases GROUP BY intake_status`).all();

  res.json({
    totals: { totalClients, totalEmployees, activeCases, closedCases, openTickets, arCases, arRecovered,
              revenuePaid: revenue.paid, revenueDue: revenue.due },
    monthly_cases: monthlyCases, monthly_consults: monthlyConsults,
    tickets_by_status: ticketsByStatus, cases_by_service: casesByService, ar_by_status: arByStatus
  });
});

router.post('/cms/seed-extras', requireEmployee, requireRole('admin'), (req, res) => {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM practice_areas`).get().c;
  if (count === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS practice_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        icon TEXT,
        short_desc TEXT,
        full_desc TEXT,
        display_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO practice_areas (slug, title, icon, short_desc, full_desc, display_order) VALUES
      ('family-law', 'Family Law', 'fa-users', 'Divorce, custody, adoption.', 'Comprehensive family law services.', 1),
      ('asset-recovery', 'Asset Recovery (Digital)', 'fa-shield-halved', 'Crypto scam & digital asset recovery.', 'Specialized recovery services for victims of online scams and digital asset theft.', 0);
    `);
  }
  res.json({ ok: true });
});

module.exports = router;