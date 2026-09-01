# Justice Law Firm – Dynamic Platform

A complete legal services web platform with three role-based portals:

- **Public Marketing Site** (`/`) – The original hero/practice-areas/attorneys/blog site, now extended with a Digital Asset Recovery service
- **Client Portal** (`/portal/`) – Customer signup/login, case timeline tracker, support tickets, invoices, profile, and a specialized asset-recovery intake form
- **Employee Portal** (`/employee/`) – Role-based workspace for Attorneys, Paralegals, Receptionists, and Investigators
- **Admin Panel** (`/admin/`) – CMS, employee management, intake inbox, analytics with charts

Built on Node.js + Express + SQLite (via `sql.js`, zero native-compile needed).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the server (seeds the database on first launch)
npm start
```

Then open <http://localhost:3000>

### Default credentials (created automatically on first run)

| Role            | Email                          | Password      |
|-----------------|--------------------------------|---------------|
| Admin           | `admin@justicefirm.com`        | `admin123`    |
| Attorney        | `robert@justicefirm.com`       | `password123` |
| Paralegal       | `sarah@justicefirm.com`        | `password123` |
| Receptionist    | `reception@justicefirm.com`    | `password123` |
| Investigator    | `investigator@justicefirm.com` | `password123` |
| Demo client     | `demo@client.com`              | `demo1234`    |

---

## URL map

| URL                                      | What it is                          |
|------------------------------------------|-------------------------------------|
| `/`                                      | Public marketing site               |
| `/auth/login.html`                       | Client sign in                      |
| `/auth/signup.html`                      | Client registration                 |
| `/auth/employee-login.html`              | Employee sign in                    |
| `/portal/dashboard.html`                 | Client dashboard                    |
| `/portal/cases.html`                     | All client cases                    |
| `/portal/case-detail.html?id=N`           | Case timeline                       |
| `/portal/tickets.html`                   | Support tickets                     |
| `/portal/asset-recovery.html`            | Digital asset recovery list         |
| `/portal/asset-recovery-intake.html`     | File new recovery case (multi-step) |
| `/portal/billing.html`                   | Invoices                            |
| `/portal/profile.html`                   | Profile, notifications, password    |
| `/employee/dashboard.html`               | Role-aware employee dashboard       |
| `/employee/cases.html`                   | My/All cases (with event timeline)  |
| `/employee/tickets.html`                 | Assigned tickets inbox              |
| `/employee/asset-recovery.html`          | Investigator's recovery queue       |
| `/employee/intake.html`                  | Consultation + contact submissions  |
| `/admin/dashboard.html`                  | Analytics with charts               |
| `/admin/employees.html`                  | CRUD employees + role assignment    |
| `/admin/clients.html`                    | Client directory                    |

---

## Architecture

```
firm_web/
├── index.html, about.html, style.css, script.js   ← public marketing site
├── server/
│   ├── index.js              ← Express bootstrap
│   ├── db/database.js        ← sql.js schema + seeding
│   ├── middleware/auth.js    ← JWT + cookie auth, role guards
│   ├── routes/
│   │   ├── auth.js           ← /api/auth (client + employee login/signup)
│   │   ├── cases.js          ← /api/cases
│   │   ├── tickets.js        ← /api/tickets
│   │   ├── assetRecovery.js  ← /api/asset-recovery (intake + list + detail)
│   │   ├── billing.js        ← /api/billing
│   │   ├── clientProfile.js  ← /api/me
│   │   ├── publicForms.js    ← /api/forms (consultation + contact)
│   │   ├── employee.js       ← /api/employee (role-aware endpoints)
│   │   └── admin.js          ← /api/admin (CMS + analytics + employees)
│   ├── public/
│   │   ├── auth/             ← login.html, signup.html, employee-login.html
│   │   ├── portal/           ← client portal pages (share portal.css + portal.js)
│   │   ├── employee/         ← employee portal pages
│   │   └── admin/            ← admin pages
│   └── uploads/              ← multer file uploads (auto-created)
└── server/db/firm.db         ← SQLite database file (auto-created on first run)
```

### Key design choices

- **sql.js (pure-JS SQLite)** – no native build step required; works on any platform with Node 18+
- **JWT in httpOnly cookies** – secure session management for both client and employee tokens
- **Role-based middleware** – `requireClient`, `requireEmployee`, `requireRole('admin', 'receptionist')` protect endpoints
- **Shared portal shell** – `portal.js` + `portal.css` are reused across all three role-based portals for a consistent UX
- **Real DB persistence** – data survives server restarts (file-based SQLite via sql.js export)

---

## Features implemented

### Customer portal
- Sign up / sign in / sign out with JWT cookie session
- Dashboard with active cases, tickets, balance due, asset recovery count
- My Cases list + per-case timeline with attorney updates
- Support tickets (open new, threaded conversation, status tracking)
- **Digital Asset Recovery** – specialized multi-section intake form (crypto scams, romance scams, phishing, ransomware, wallet theft, exchange fraud, etc.) with file upload + blockchain/wallet fields
- Asset recovery case list & detail with status tracking
- Billing & invoices with paid/due/overdue summary
- Profile editing, notification preferences, password change

### Employee portal (role-based)
- **Attorneys** – see assigned cases, add timeline events, client notified automatically
- **Paralegals** – case support
- **Receptionists** – intake inbox (consultation + contact form submissions) with status management
- **Investigators** – asset recovery queue, update status (submitted → under_review → evidence_gathering → tracing → recovery_action → recovered/unrecoverable), set recovered amount, client notified
- Reply to support tickets inline

### Admin panel
- Analytics dashboard with 5 charts (cases trend, consultations trend, tickets by status, cases by practice area, asset recovery status)
- Employee CRUD: create, edit, disable, reset password, assign role
- Client directory with search and suspend/reactivate
- All employee features included

### Marketing site updates
- "Client Login" link in navbar + mobile menu
- **Asset Recovery (Digital)** added as a 7th practice area card (red-accented "Specialized" badge)
- New "Digital Asset Recovery & Scam Victim Support" section with 4 capability cards, comprehensive list of scam types covered, and a CTA to file a case
- Public consultation and contact forms wired to the API (now go to the intake inbox)

---

## API reference (selected)

All API endpoints are under `/api/`. Authentication is via either:
- `Authorization: Bearer <token>` header
- `client_token` / `employee_token` httpOnly cookies (set automatically on login/signup)

### Public
- `POST /api/forms/consultation` – submit consultation form
- `POST /api/forms/contact` – submit contact form
- `POST /api/auth/signup` – register a new client
- `POST /api/auth/login` – client sign in
- `POST /api/auth/employee/login` – employee sign in
- `GET  /api/auth/me` – current user info
- `POST /api/auth/logout` – sign out

### Client
- `GET  /api/cases` – dashboard data
- `GET  /api/cases/:id` – case detail + timeline
- `GET  /api/tickets`, `POST /api/tickets`, `GET /api/tickets/:id`, `POST /api/tickets/:id/reply`
- `GET  /api/asset-recovery`, `POST /api/asset-recovery/intake` (multipart), `GET /api/asset-recovery/:id`
- `GET  /api/billing`
- `PUT  /api/me/profile`, `PUT /api/me/password`, `GET /api/me/notifications`

### Employee (token required)
- `GET  /api/employee/dashboard` – role-aware stats
- `GET  /api/employee/cases`, `GET /api/employee/cases/:id`, `POST /api/employee/cases/:id/event`
- `GET  /api/employee/tickets`, `POST /api/employee/tickets/:id/reply`, `PUT /api/employee/tickets/:id/status`
- `GET  /api/employee/asset-recovery`, `PUT /api/employee/asset-recovery/:id`
- `GET  /api/employee/intake` (admin/receptionist), `PUT /api/employee/intake/consultation/:id`, `PUT /api/employee/intake/contact/:id`

### Admin
- `GET  /api/admin/analytics` – KPIs + chart data
- `GET  /api/admin/employees`, `POST /api/admin/employees`, `PUT /api/admin/employees/:id`, `DELETE /api/admin/employees/:id`
- `GET  /api/admin/clients`, `PUT /api/admin/clients/:id/status`

---

## Development notes

- Port: `process.env.PORT || 3000`
- JWT secret: `process.env.JWT_SECRET` (defaults to a dev secret; **change for production**)
- File uploads stored in `server/uploads/` (15MB max per file, 5 files per intake)
- Database auto-saves to `server/db/firm.db` after every write (200ms debounced) and on process exit
- To reset the database: delete `server/db/firm.db` and restart the server

---

## License

Proprietary – internal Justice Law Firm project.
