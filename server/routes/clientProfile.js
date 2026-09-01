const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

router.put('/profile', requireClient, (req, res) => {
  const { first_name, last_name, phone, address, city, state, zip, country,
          notification_email, notification_sms, avatar_color } = req.body || {};
  db.prepare(`UPDATE clients SET
    first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name),
    phone=?, address=?, city=?, state=?, zip=?, country=?,
    notification_email=COALESCE(?,notification_email),
    notification_sms=COALESCE(?,notification_sms),
    avatar_color=COALESCE(?,avatar_color)
    WHERE id=?`).run(
    first_name || null, last_name || null,
    phone || null, address || null, city || null, state || null, zip || null, country || null,
    notification_email === undefined ? null : (notification_email ? 1 : 0),
    notification_sms === undefined ? null : (notification_sms ? 1 : 0),
    avatar_color || null,
    req.user.sub);
  res.json({ ok: true });
});

router.put('/password', requireClient, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields are required.' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  const c = db.prepare('SELECT password_hash FROM clients WHERE id = ?').get(req.user.sub);
  if (!c) return res.status(404).json({ error: 'Account not found.' });
  if (!bcrypt.compareSync(current_password, c.password_hash)) return res.status(401).json({ error: 'Current password is incorrect.' });

  db.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.sub);
  res.json({ ok: true });
});

router.get('/notifications', requireClient, (req, res) => {
  const notifs = db.prepare(`SELECT * FROM notifications WHERE user_type='client' AND user_id=? ORDER BY created_at DESC LIMIT 50`).all(req.user.sub);
  res.json({ notifications: notifs });
});

router.post('/notifications/read-all', requireClient, (req, res) => {
  db.prepare(`UPDATE notifications SET read=1 WHERE user_type='client' AND user_id=?`).run(req.user.sub);
  res.json({ ok: true });
});

module.exports = router;