const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.post('/consultation', (req, res) => {
  const { name, email, phone, practice_area, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required.' });

  const intake = db.prepare(`SELECT id FROM employees WHERE role='receptionist' AND status='active' LIMIT 1`).get();
  db.prepare(`INSERT INTO consultations (name, email, phone, practice_area, message, assigned_to)
              VALUES (?, ?, ?, ?, ?, ?)`).run(name.trim(), email.trim().toLowerCase(),
              phone || null, practice_area || null, message.trim(), intake?.id || null);

  if (intake) {
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('employee', ?, ?, ?, ?)`)
      .run(intake.id, 'New Consultation Request', `${name} - ${practice_area || 'General'}`,
           `/employee/intake.html`);
  }
  res.json({ ok: true });
});

router.post('/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required.' });

  const intake = db.prepare(`SELECT id FROM employees WHERE role='receptionist' AND status='active' LIMIT 1`).get();
  db.prepare(`INSERT INTO contact_messages (name, email, phone, subject, message, assigned_to)
              VALUES (?, ?, ?, ?, ?, ?)`).run(name.trim(), email.trim().toLowerCase(),
              phone || null, subject || null, message.trim(), intake?.id || null);

  if (intake) {
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('employee', ?, ?, ?, ?)`)
      .run(intake.id, 'New Contact Message', `${name} - ${subject || 'General'}`,
           `/employee/intake.html`);
  }
  res.json({ ok: true });
});

module.exports = router;