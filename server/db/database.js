const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'firm.db');
let db = null;
let SQL = null;
let saveTimer = null;

function persist() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = Buffer.from(db.export());
      fs.writeFileSync(dbPath, data);
    } catch (e) { console.error('[DB] Save error:', e.message); }
  }, 200);
}

function persistSync() {
  if (!db) return;
  try {
    const data = Buffer.from(db.export());
    fs.writeFileSync(dbPath, data);
  } catch (e) { console.error('[DB] Sync save error:', e.message); }
}

class QueryResult {
  constructor(sqlJsRows) {
    if (!sqlJsRows || sqlJsRows.length === 0) {
      this._rows = [];
    } else {
      const cols = sqlJsRows[0].columns;
      this._rows = sqlJsRows[0].values.map(vals => {
        const o = {};
        cols.forEach((c, i) => { o[c] = vals[i]; });
        return o;
      });
    }
  }
  all() { return this._rows; }
  get() { return this._rows[0]; }
  run(...args) { return { lastInsertRowid: 0, changes: 0 }; }
}

const wrapper = {
  prepare(sql) {
    return {
      all(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        } catch (e) {
          if (sql.includes('-- ignored')) return [];
          console.error('[DB] Query error:', e.message, '\nSQL:', sql);
          return [];
        }
      },
      get(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          let row = undefined;
          if (stmt.step()) row = stmt.getAsObject();
          stmt.free();
          return row;
        } catch (e) {
          console.error('[DB] Query error:', e.message);
          return undefined;
        }
      },
      run(...params) {
        try {
          const cleanParams = params.map(p => p === undefined ? null : p);
          const stmt = db.prepare(sql);
          stmt.bind(cleanParams);
          stmt.step();
          stmt.free();
          const idStmt = db.prepare("SELECT last_insert_rowid() AS id");
          idStmt.step();
          const idRow = idStmt.getAsObject();
          idStmt.free();
          persist();
          return { lastInsertRowid: Number(idRow.id || 0), changes: 1 };
        } catch (e) {
          console.error('[DB] Run error:', e && e.message ? e.message : JSON.stringify(e), '\nSQL:', sql);
          return { lastInsertRowid: 0, changes: 0 };
        }
      }
    };
  },
  exec(sql) {
    try {
      db.exec(sql);
      persist();
    } catch (e) { console.error('[DB] Exec error:', e.message); }
  },
  pragma(p) { try { db.exec(`PRAGMA ${p}`); } catch (e) {} }
};

async function init() {
  if (db) return;
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  createSchema();
  seed();
  persistSync();
  console.log('[DB] Database ready at', dbPath);
}

function createSchema() {
  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT DEFAULT 'USA',
      notification_email INTEGER DEFAULT 1,
      notification_sms INTEGER DEFAULT 0,
      avatar_color TEXT DEFAULT '#c9a84c',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT,
      department TEXT,
      phone TEXT,
      avatar TEXT,
      avatar_color TEXT DEFAULT '#c9a84c',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      assigned_attorney_id INTEGER,
      assigned_paralegal_id INTEGER,
      service_category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS case_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      assigned_to INTEGER,
      subject TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS asset_recovery_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      assigned_investigator_id INTEGER,
      related_case_id INTEGER,
      incident_type TEXT NOT NULL,
      scam_platform TEXT,
      scam_date DATE,
      amount_lost TEXT,
      currency TEXT DEFAULT 'USD',
      payment_method TEXT,
      wallet_address TEXT,
      transaction_hash TEXT,
      blockchain TEXT,
      exchange_name TEXT,
      suspect_info TEXT,
      has_police_report INTEGER DEFAULT 0,
      evidence_description TEXT,
      intake_status TEXT DEFAULT 'submitted',
      recovery_amount TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      case_id INTEGER,
      issue_date DATE DEFAULT (DATE('now')),
      due_date DATE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      description TEXT,
      paid_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      practice_area TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      assigned_to INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      assigned_to INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
    CREATE INDEX IF NOT EXISTS idx_events_case ON case_events(case_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_type, user_id, read);
  `);
}

function seed() {
  const adminCount = wrapper.prepare("SELECT COUNT(*) AS c FROM employees WHERE role='admin'").get();
  if (!adminCount || adminCount.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    wrapper.prepare(`INSERT INTO employees (first_name, last_name, email, password_hash, role, title, department)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('System', 'Administrator', 'admin@justicefirm.com', hash, 'admin', 'Managing Partner', 'Administration');
    console.log('[DB] Seeded default admin: admin@justicefirm.com / admin123');
  }

  const employeeCount = wrapper.prepare('SELECT COUNT(*) AS c FROM employees').get();
  if (!employeeCount || employeeCount.c < 5) {
    const hash = bcrypt.hashSync('password123', 10);
    const seeds = [
      ['Robert', 'Anderson', 'robert@justicefirm.com', 'attorney', 'Senior Partner', 'Family Law'],
      ['Michael', 'Thompson', 'michael@justicefirm.com', 'attorney', 'Partner', 'Personal Injury'],
      ['Jennifer', 'Morgan', 'jennifer@justicefirm.com', 'attorney', 'Partner', 'Immigration Law'],
      ['Sarah', 'Williams', 'sarah@justicefirm.com', 'paralegal', 'Senior Paralegal', 'Real Estate'],
      ['Daniel', 'Park', 'daniel@justicefirm.com', 'attorney', 'Associate', 'Intellectual Property'],
      ['Amara', 'Osei', 'amara@justicefirm.com', 'attorney', 'Associate', 'Civil Law'],
      ['Maria', 'Reception', 'reception@justicefirm.com', 'receptionist', 'Front Desk Coordinator', 'Intake'],
      ['Marcus', 'Voss', 'investigator@justicefirm.com', 'investigator', 'Senior Investigator', 'Asset Recovery'],
    ];
    for (const [first, last, email, role, title, department] of seeds) {
      try {
        wrapper.prepare(`INSERT INTO employees (first_name, last_name, email, password_hash, role, title, department) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(first, last, email, hash, role, title, department);
      } catch (e) {}
    }
    console.log('[DB] Seeded sample employees (password: password123)');
  }

  const clientCount = wrapper.prepare('SELECT COUNT(*) AS c FROM clients').get();
  if (!clientCount || clientCount.c === 0) {
    const hash = bcrypt.hashSync('demo1234', 10);
    const c = wrapper.prepare(`INSERT INTO clients (first_name, last_name, email, password_hash, phone, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('Demo', 'Client', 'demo@client.com', hash, '(555) 123-4567', 'New York', 'NY');
    const clientId = c.lastInsertRowid;
    const attorney = wrapper.prepare("SELECT id FROM employees WHERE role='attorney' LIMIT 1").get();
    const investigator = wrapper.prepare("SELECT id FROM employees WHERE role='investigator' LIMIT 1").get();
    const intake = wrapper.prepare("SELECT id FROM employees WHERE role='receptionist' LIMIT 1").get();

    const c1 = wrapper.prepare(`INSERT INTO cases (case_number, client_id, assigned_attorney_id, service_category, title, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('CASE-2026-0001', clientId, attorney?.id, 'Family Law', 'Anderson Divorce Proceedings', 'Contested divorce with child custody arrangements.', 'in_progress');
    const c2 = wrapper.prepare(`INSERT INTO cases (case_number, client_id, assigned_attorney_id, service_category, title, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('CASE-2026-0002', clientId, attorney?.id, 'Personal Injury', 'MVA Settlement Claim', 'Rear-end collision at intersection of 5th & Main.', 'open');

    wrapper.prepare(`INSERT INTO case_events (case_id, author_type, author_id, event_type, title, details) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(c1.lastInsertRowid, 'employee', attorney?.id, 'filing', 'Initial Petition Filed', 'Petition filed with the county clerk on 2026-01-15.');
    wrapper.prepare(`INSERT INTO case_events (case_id, author_type, author_id, event_type, title, details) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(c1.lastInsertRowid, 'employee', attorney?.id, 'hearing', 'First Hearing Scheduled', 'Custody hearing set for 2026-03-02.');
    wrapper.prepare(`INSERT INTO case_events (case_id, author_type, author_id, event_type, title, details) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(c1.lastInsertRowid, 'client', clientId, 'update', 'Documents Uploaded', 'Client uploaded financial disclosure forms.');

    const t1 = wrapper.prepare(`INSERT INTO tickets (ticket_number, client_id, subject, category, status, assigned_to) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('TKT-0001', clientId, 'Question about court date', 'general', 'open', intake?.id);
    wrapper.prepare(`INSERT INTO ticket_messages (ticket_id, author_type, author_id, message) VALUES (?, ?, ?, ?)`)
      .run(t1.lastInsertRowid, 'client', clientId, 'Hi, can you confirm the time of my hearing on March 2nd?');

    wrapper.prepare(`INSERT INTO asset_recovery_cases
      (case_number, client_id, assigned_investigator_id, incident_type, scam_platform, scam_date, amount_lost, currency,
       payment_method, wallet_address, blockchain, exchange_name, has_police_report, evidence_description, intake_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('AR-2026-0001', clientId, investigator?.id,
       'crypto_scam', 'BitConnect-style platform', '2025-11-14', '45000', 'USD',
       'Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'Bitcoin', 'Coinbase', 1,
       'Provided wallet transaction screenshots, emails from scam operators, and IC3 report.', 'under_review');

    wrapper.prepare(`INSERT INTO invoices (invoice_number, client_id, case_id, amount, status, description, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('INV-2026-0001', clientId, c1.lastInsertRowid, 2500.00, 'paid', 'Retainer - Family Law Case', '2026-01-30');
    wrapper.prepare(`INSERT INTO invoices (invoice_number, client_id, case_id, amount, status, description, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('INV-2026-0002', clientId, c1.lastInsertRowid, 850.00, 'pending', 'Filing fees & paralegal hours (Feb)', '2026-03-01');
    wrapper.prepare(`INSERT INTO invoices (invoice_number, client_id, case_id, amount, status, description, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('INV-2026-0003', clientId, c2.lastInsertRowid, 1750.00, 'pending', 'Initial case intake & investigation', '2026-03-15');

    wrapper.prepare(`INSERT INTO consultations (name, email, phone, practice_area, message, status) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('John Smith', 'john@example.com', '555-0101', 'Personal Injury', 'I was hit by a drunk driver last week.', 'new');
    wrapper.prepare(`INSERT INTO consultations (name, email, phone, practice_area, message, status) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('Emily Chen', 'emily@example.com', '555-0202', 'Asset Recovery', 'Lost $12k to a romance scam, sent via wire.', 'new');
    wrapper.prepare(`INSERT INTO contact_messages (name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('Pat Wilson', 'pat@example.com', '555-0303', 'General Inquiry', 'What are your office hours?', 'new');

    console.log('[DB] Seeded demo client (demo@client.com / demo1234) with cases, tickets, asset recovery, invoices.');
  }
}

process.on('exit', persistSync);
process.on('SIGINT', () => { persistSync(); process.exit(0); });
process.on('SIGTERM', () => { persistSync(); process.exit(0); });

module.exports = { db: wrapper, init, persist: persistSync };