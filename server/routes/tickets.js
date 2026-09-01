const express = require('express');
const { db } = require('../db/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireClient, (req, res) => {
  const tickets = db.prepare(`SELECT id, ticket_number, subject, category, priority, status, created_at, updated_at
                              FROM tickets WHERE client_id = ? ORDER BY updated_at DESC`).all(req.user.sub);
  res.json({ tickets });
});

router.post('/', requireClient, (req, res) => {
  const { subject, message, category, priority } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });

  const count = db.prepare('SELECT COUNT(*) AS c FROM tickets').get().c + 1;
  const ticketNumber = `TKT-${String(count).padStart(4, '0')}`;

  const intake = db.prepare(`SELECT id FROM employees WHERE role='receptionist' AND status='active' LIMIT 1`).get();

  const info = db.prepare(`INSERT INTO tickets (ticket_number, client_id, assigned_to, subject, category, priority)
                           VALUES (?, ?, ?, ?, ?, ?)`)
    .run(ticketNumber, req.user.sub, intake?.id || null, subject.trim(),
         category || 'general', priority || 'normal');

  db.prepare(`INSERT INTO ticket_messages (ticket_id, author_type, author_id, message) VALUES (?, ?, ?, ?)`)
    .run(info.lastInsertRowid, 'client', req.user.sub, message.trim());

  if (intake) {
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link)
                VALUES ('employee', ?, ?, ?, ?)`)
      .run(intake.id, 'New support ticket', `Ticket ${ticketNumber}: ${subject}`,
           `/employee/tickets.html?id=${info.lastInsertRowid}`);
  }

  res.json({ id: info.lastInsertRowid, ticket_number: ticketNumber });
});

router.get('/:id', requireClient, (req, res) => {
  const tid = parseInt(req.params.id);
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ? AND client_id = ?`).get(tid, req.user.sub);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const messages = db.prepare(`
    SELECT tm.*, tm.author_type,
           CASE WHEN tm.author_type='client' THEN (c.first_name || ' ' || c.last_name)
                ELSE (e.first_name || ' ' || e.last_name) END AS author_name,
           CASE WHEN tm.author_type='employee' THEN e.role ELSE NULL END AS author_role
    FROM ticket_messages tm
    LEFT JOIN clients c ON tm.author_type='client' AND c.id = tm.author_id
    LEFT JOIN employees e ON tm.author_type='employee' AND e.id = tm.author_id
    WHERE tm.ticket_id = ? ORDER BY tm.created_at ASC`).all(tid);
  res.json({ ticket, messages });
});

router.post('/:id/reply', requireClient, (req, res) => {
  const tid = parseInt(req.params.id);
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ? AND client_id = ?`).get(tid, req.user.sub);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!req.body?.message) return res.status(400).json({ error: 'Message is required.' });

  db.prepare(`INSERT INTO ticket_messages (ticket_id, author_type, author_id, message) VALUES (?, ?, ?, ?)`)
    .run(tid, 'client', req.user.sub, req.body.message.trim());
  db.prepare(`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP, status = CASE WHEN status='resolved' THEN 'open' ELSE status END WHERE id = ?`).run(tid);

  if (ticket.assigned_to) {
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('employee', ?, ?, ?, ?)`)
      .run(ticket.assigned_to, 'Ticket reply', `${ticket.ticket_number}: client replied`,
           `/employee/tickets.html?id=${tid}`);
  }
  res.json({ ok: true });
});

module.exports = router;