const express = require('express');
const { db } = require('../db/database');
const { requireEmployee, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireEmployee, (req, res) => {
  const role = req.user.role;
  const uid = req.user.sub;

  const baseStats = {
    open_cases: db.prepare(`SELECT COUNT(*) AS c FROM cases WHERE status NOT IN ('closed','won','lost')`).get().c,
    open_tickets: db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE status NOT IN ('resolved','closed')`).get().c,
    consultations_new: db.prepare(`SELECT COUNT(*) AS c FROM consultations WHERE status='new'`).get().c,
    contacts_new: db.prepare(`SELECT COUNT(*) AS c FROM contact_messages WHERE status='new'`).get().c,
    ar_open: db.prepare(`SELECT COUNT(*) AS c FROM asset_recovery_cases WHERE intake_status NOT IN ('recovered','closed','unrecoverable')`).get().c,
    overdue_invoices: db.prepare(`SELECT COUNT(*) AS c FROM invoices WHERE status='overdue' OR (status='pending' AND due_date < DATE('now'))`).get().c,
  };

  const recent_consults = db.prepare(`SELECT id, name, practice_area, message, created_at FROM consultations ORDER BY created_at DESC LIMIT 5`).all();
  const recent_contacts = db.prepare(`SELECT id, name, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5`).all();
  const recent_tickets = db.prepare(`SELECT id, ticket_number, subject, status, updated_at FROM tickets ORDER BY updated_at DESC LIMIT 5`).all();

  let roleStats = {};
  if (role === 'attorney') {
    roleStats = {
      my_cases: db.prepare(`SELECT COUNT(*) AS c FROM cases WHERE assigned_attorney_id=? AND status NOT IN ('closed','won','lost')`).get(uid).c,
      pending_updates: db.prepare(`SELECT COUNT(*) AS c FROM case_events WHERE case_id IN (SELECT id FROM cases WHERE assigned_attorney_id=?) AND event_type='update'`).get(uid).c,
    };
  } else if (role === 'paralegal') {
    roleStats = {
      my_cases: db.prepare(`SELECT COUNT(*) AS c FROM cases WHERE assigned_paralegal_id=? OR assigned_attorney_id IN (SELECT id FROM employees WHERE department='Real Estate')`).get(uid).c,
    };
  } else if (role === 'receptionist') {
    roleStats = {
      my_consults: db.prepare(`SELECT COUNT(*) AS c FROM consultations WHERE assigned_to=? AND status='new'`).get(uid).c,
      my_contacts: db.prepare(`SELECT COUNT(*) AS c FROM contact_messages WHERE assigned_to=? AND status='new'`).get(uid).c,
      my_tickets: db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE assigned_to=? AND status NOT IN ('resolved','closed')`).get(uid).c,
    };
  } else if (role === 'investigator') {
    roleStats = {
      my_cases: db.prepare(`SELECT COUNT(*) AS c FROM asset_recovery_cases WHERE assigned_investigator_id=? AND intake_status NOT IN ('recovered','closed','unrecoverable')`).get(uid).c,
    };
  } else if (role === 'admin') {
    roleStats = {
      total_clients: db.prepare(`SELECT COUNT(*) AS c FROM clients`).get().c,
      total_employees: db.prepare(`SELECT COUNT(*) AS c FROM employees WHERE status='active'`).get().c,
      revenue_paid: db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE status='paid'`).get().s,
      revenue_due: db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE status IN ('pending','overdue')`).get().s,
    };
  }

  res.json({ base_stats: baseStats, role_stats: roleStats, recent_consults, recent_contacts, recent_tickets, role });
});

router.get('/cases', requireEmployee, (req, res) => {
  const role = req.user.role;
  const uid = req.user.sub;
  let sql = `
    SELECT c.*, cl.first_name AS client_first, cl.last_name AS client_last, cl.email AS client_email,
           e.first_name AS atty_first, e.last_name AS atty_last
    FROM cases c
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN employees e ON e.id = c.assigned_attorney_id`;
  const params = [];
  if (role === 'attorney') { sql += ` WHERE c.assigned_attorney_id = ?`; params.push(uid); }
  else if (role === 'paralegal') { sql += ` WHERE c.assigned_paralegal_id = ?`; params.push(uid); }
  sql += ` ORDER BY c.opened_at DESC`;
  const cases = db.prepare(sql).all(...params);
  res.json({ cases });
});

router.get('/cases/:id', requireEmployee, (req, res) => {
  const id = parseInt(req.params.id);
  const c = db.prepare(`
    SELECT c.*, cl.first_name AS client_first, cl.last_name AS client_last, cl.email AS client_email, cl.phone AS client_phone,
           e.first_name AS atty_first, e.last_name AS atty_last
    FROM cases c
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN employees e ON e.id = c.assigned_attorney_id
    WHERE c.id = ?`).get(id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const events = db.prepare(`SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at DESC`).all(id);
  res.json({ case: c, events });
});

router.post('/cases/:id/event', requireEmployee, (req, res) => {
  const id = parseInt(req.params.id);
  const { event_type, title, details } = req.body || {};
  if (!event_type || !title) return res.status(400).json({ error: 'Event type and title required.' });
  const c = db.prepare('SELECT client_id FROM cases WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  db.prepare(`INSERT INTO case_events (case_id, author_type, author_id, event_type, title, details) VALUES (?, 'employee', ?, ?, ?, ?)`)
    .run(id, req.user.sub, event_type, title.trim(), details || null);

  db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('client', ?, ?, ?, ?)`)
    .run(c.client_id, `Update on your case`, title, `/portal/case-detail.html?id=${id}`);

  res.json({ ok: true });
});

router.get('/tickets', requireEmployee, (req, res) => {
  const role = req.user.role;
  const uid = req.user.sub;
  let sql = `
    SELECT t.*, cl.first_name AS client_first, cl.last_name AS client_last, e.first_name AS atty_first, e.last_name AS atty_last
    FROM tickets t LEFT JOIN clients cl ON cl.id = t.client_id LEFT JOIN employees e ON e.id = t.assigned_to`;
  const params = [];
  if (role === 'receptionist') { sql += ` WHERE t.assigned_to = ? OR t.assigned_to IS NULL`; params.push(uid); }
  else if (['attorney', 'paralegal', 'investigator'].includes(role)) { sql += ` WHERE t.assigned_to = ?`; params.push(uid); }
  sql += ` ORDER BY t.updated_at DESC`;
  const tickets = db.prepare(sql).all(...params);
  res.json({ tickets });
});

router.post('/tickets/:id/reply', requireEmployee, (req, res) => {
  const id = parseInt(req.params.id);
  const { message, status } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  db.prepare(`INSERT INTO ticket_messages (ticket_id, author_type, author_id, message) VALUES (?, 'employee', ?, ?)`)
    .run(id, req.user.sub, message.trim());
  db.prepare(`UPDATE tickets SET updated_at=CURRENT_TIMESTAMP, status=COALESCE(?, status) WHERE id = ?`)
    .run(status || null, id);

  db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('client', ?, ?, ?, ?)`)
    .run(t.client_id, `Reply on ticket ${t.ticket_number}`, message.slice(0, 100), `/portal/tickets.html?id=${id}`);

  res.json({ ok: true });
});

router.put('/tickets/:id/status', requireEmployee, (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body || {};
  if (!['open','in_progress','waiting','resolved','closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status, id);
  res.json({ ok: true });
});

router.get('/intake', requireEmployee, requireRole('admin', 'receptionist'), (req, res) => {
  const consults = db.prepare(`SELECT * FROM consultations ORDER BY created_at DESC`).all();
  const contacts = db.prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC`).all();
  res.json({ consults, contacts });
});

router.put('/intake/consultation/:id', requireEmployee, requireRole('admin', 'receptionist'), (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body || {};
  db.prepare(`UPDATE consultations SET status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?`)
    .run(status || null, notes || null, id);
  res.json({ ok: true });
});

router.put('/intake/contact/:id', requireEmployee, requireRole('admin', 'receptionist'), (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body || {};
  db.prepare(`UPDATE contact_messages SET status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?`)
    .run(status || null, notes || null, id);
  res.json({ ok: true });
});

router.get('/asset-recovery', requireEmployee, (req, res) => {
  const role = req.user.role;
  const uid = req.user.sub;
  let sql = `
    SELECT ar.*, cl.first_name AS client_first, cl.last_name AS client_last, cl.email AS client_email,
           e.first_name AS inv_first, e.last_name AS inv_last
    FROM asset_recovery_cases ar
    LEFT JOIN clients cl ON cl.id = ar.client_id
    LEFT JOIN employees e ON e.id = ar.assigned_investigator_id`;
  const params = [];
  if (role === 'investigator') { sql += ` WHERE ar.assigned_investigator_id = ?`; params.push(uid); }
  sql += ` ORDER BY ar.created_at DESC`;
  const cases = db.prepare(sql).all(...params);
  res.json({ cases });
});

router.put('/asset-recovery/:id', requireEmployee, (req, res) => {
  const id = parseInt(req.params.id);
  const { intake_status, recovery_amount, notes, assigned_investigator_id } = req.body || {};
  const ar = db.prepare('SELECT client_id FROM asset_recovery_cases WHERE id=?').get(id);
  if (!ar) return res.status(404).json({ error: 'Case not found' });

  const existing = db.prepare(`SELECT * FROM asset_recovery_cases WHERE id=?`).get(id);
  const updates = [];
  const params = [];
  if (intake_status) { updates.push('intake_status=?'); params.push(intake_status); }
  if (recovery_amount !== undefined) { updates.push('recovery_amount=?'); params.push(recovery_amount); }
  if (assigned_investigator_id) { updates.push('assigned_investigator_id=?'); params.push(assigned_investigator_id); }
  updates.push('updated_at=CURRENT_TIMESTAMP');
  if (notes) {
    db.prepare(`UPDATE asset_recovery_cases SET evidence_description = evidence_description || '\n\n[' || datetime('now') || '] ' || ? WHERE id=?`)
      .run(notes, id);
  }
  params.push(id);
  db.prepare(`UPDATE asset_recovery_cases SET ${updates.join(', ')} WHERE id=?`).run(...params);

  if (intake_status && intake_status !== existing.intake_status) {
    db.prepare(`INSERT INTO case_events (case_id, author_type, author_id, event_type, title, details)
                VALUES (?, 'employee', ?, 'status', ?, ?)`)
      .run(id, req.user.sub, `Status changed to ${intake_status}`, notes || null);
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('client', ?, ?, ?, ?)`)
      .run(ar.client_id, `Asset recovery case update`, `Status: ${intake_status}`, `/portal/asset-recovery.html?id=${id}`);
  }
  res.json({ ok: true });
});

module.exports = router;