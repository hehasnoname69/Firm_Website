const express = require('express');
const { db } = require('../db/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireClient, (req, res) => {
  const cases = db.prepare(`
    SELECT c.id, c.case_number, c.title, c.service_category, c.status, c.priority, c.opened_at, c.closed_at,
           e.first_name AS attorney_first, e.last_name AS attorney_last
    FROM cases c
    LEFT JOIN employees e ON e.id = c.assigned_attorney_id
    WHERE c.client_id = ?
    ORDER BY c.opened_at DESC`).all(req.user.sub);

  const tickets = db.prepare(`SELECT id, ticket_number, subject, status, created_at FROM tickets WHERE client_id = ? ORDER BY created_at DESC LIMIT 5`).all(req.user.sub);
  const invoices = db.prepare(`SELECT id, invoice_number, amount, status, due_date FROM invoices WHERE client_id = ? ORDER BY issue_date DESC LIMIT 5`).all(req.user.sub);
  const arCases = db.prepare(`SELECT id, case_number, incident_type, amount_lost, currency, intake_status FROM asset_recovery_cases WHERE client_id = ? ORDER BY created_at DESC`).all(req.user.sub);

  const unread = db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_type='client' AND user_id=? AND read=0`).get(req.user.sub).c;

  res.json({ cases, tickets, invoices, arCases, unread_notifications: unread });
});

router.get('/:id', requireClient, (req, res) => {
  const caseId = parseInt(req.params.id);
  const c = db.prepare(`
    SELECT c.*, e.first_name AS attorney_first, e.last_name AS attorney_last, e.email AS attorney_email
    FROM cases c LEFT JOIN employees e ON e.id = c.assigned_attorney_id
    WHERE c.id = ? AND c.client_id = ?`).get(caseId, req.user.sub);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const events = db.prepare(`SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at DESC`).all(caseId);
  res.json({ case: c, events });
});

module.exports = router;