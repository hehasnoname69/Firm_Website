const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${req.user.sub}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const VALID_INCIDENT_TYPES = ['crypto_scam', 'romance_scam', 'investment_scam', 'phishing', 'ransomware',
                              'wallet_theft', 'exchange_fraud', 'fake_ico', 'pig_butchering', 'other_digital_asset'];
const VALID_PAYMENT_METHODS = ['Bitcoin', 'Ethereum', 'USDT', 'Wire Transfer', 'Credit Card', 'Gift Card', 'Cash App', 'PayPal', 'Other'];
const VALID_BLOCKCHAINS = ['Bitcoin', 'Ethereum', 'BNB Chain', 'Polygon', 'Solana', 'Tron', 'Other', 'N/A'];

router.get('/', requireClient, (req, res) => {
  const cases = db.prepare(`
    SELECT ar.*, e.first_name AS inv_first, e.last_name AS inv_last
    FROM asset_recovery_cases ar
    LEFT JOIN employees e ON e.id = ar.assigned_investigator_id
    WHERE ar.client_id = ?
    ORDER BY ar.created_at DESC`).all(req.user.sub);
  res.json({ cases });
});

router.post('/intake', requireClient, upload.array('evidence_files', 5), (req, res) => {
  const b = req.body || {};
  if (!b.incident_type || !VALID_INCIDENT_TYPES.includes(b.incident_type)) {
    return res.status(400).json({ error: 'A valid incident type is required.' });
  }
  if (!b.amount_lost || !b.scam_date) {
    return res.status(400).json({ error: 'Amount lost and scam date are required.' });
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM asset_recovery_cases').get().c + 1;
  const caseNumber = `AR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
  const investigator = db.prepare(`SELECT id FROM employees WHERE role='investigator' AND status='active' LIMIT 1`).get();

  const fileMeta = (req.files || []).map(f => ({ name: f.originalname, path: `/uploads/${f.filename}`, size: f.size }));
  const evidenceText = b.evidence_description ? b.evidence_description + (fileMeta.length ? '\n\nUploaded files:\n' + fileMeta.map(m => '- ' + m.name).join('\n') : '') : fileMeta.map(m => '- ' + m.name).join('\n');

  const info = db.prepare(`
    INSERT INTO asset_recovery_cases
    (case_number, client_id, assigned_investigator_id, incident_type, scam_platform, scam_date, amount_lost, currency,
     payment_method, wallet_address, transaction_hash, blockchain, exchange_name, suspect_info,
     has_police_report, evidence_description, intake_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`)
    .run(caseNumber, req.user.sub, investigator?.id || null,
         b.incident_type, b.scam_platform || null, b.scam_date, b.amount_lost, b.currency || 'USD',
         b.payment_method || null, b.wallet_address || null, b.transaction_hash || null,
         b.blockchain || null, b.exchange_name || null, b.suspect_info || null,
         b.has_police_report === 'on' || b.has_police_report === true ? 1 : 0,
         evidenceText || null);

  if (investigator) {
    db.prepare(`INSERT INTO notifications (user_type, user_id, title, body, link) VALUES ('employee', ?, ?, ?, ?)`)
      .run(investigator.id, 'New Asset Recovery Intake', `${caseNumber}: ${b.incident_type} - $${b.amount_lost} loss`,
           `/employee/asset-recovery.html?id=${info.lastInsertRowid}`);
  }

  res.json({ id: info.lastInsertRowid, case_number: caseNumber, files: fileMeta });
});

router.get('/:id', requireClient, (req, res) => {
  const id = parseInt(req.params.id);
  const ar = db.prepare(`SELECT * FROM asset_recovery_cases WHERE id = ? AND client_id = ?`).get(id, req.user.sub);
  if (!ar) return res.status(404).json({ error: 'Case not found' });
  const events = db.prepare(`SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at DESC`).all(id);
  res.json({ case: ar, events });
});

module.exports = router;