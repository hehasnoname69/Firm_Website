const express = require('express');
const { db } = require('../db/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireClient, (req, res) => {
  const invoices = db.prepare(`SELECT * FROM invoices WHERE client_id = ? ORDER BY issue_date DESC`).all(req.user.sub);
  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS total_paid,
      SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) AS total_due,
      SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) AS overdue_count
    FROM invoices WHERE client_id = ?`).get(req.user.sub);
  res.json({ invoices, summary: summary || { total_paid: 0, total_due: 0, overdue_count: 0 } });
});

module.exports = router;