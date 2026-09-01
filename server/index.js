const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');

const { init, db } = require('./db/database');
const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const ticketRoutes = require('./routes/tickets');
const arRoutes = require('./routes/assetRecovery');
const billingRoutes = require('./routes/billing');
const profileRoutes = require('./routes/clientProfile');
const publicFormsRoutes = require('./routes/publicForms');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');
const { attachUserIfPresent } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');

(async () => {
  await init();

const app = express();
app.use(cors());
app.use(cookieParser());
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) return next();
  express.json({ limit: '2mb' })(req, res, () =>
    express.urlencoded({ extended: true })(req, res, next)
  );
});

app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/asset-recovery', arRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/forms', publicFormsRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/auth', express.static(path.join(PUBLIC, 'auth')));
app.use('/portal', attachUserIfPresent, express.static(path.join(PUBLIC, 'portal')));
app.use('/employee', attachUserIfPresent, express.static(path.join(PUBLIC, 'employee')));
app.use('/admin', attachUserIfPresent, express.static(path.join(PUBLIC, 'admin')));
app.use(express.static(ROOT));

app.get('/portal', (req, res) => {
  if (!req.cookies.client_token) return res.redirect('/auth/login.html');
  res.redirect('/portal/dashboard.html');
});
app.get('/employee', (req, res) => {
  if (!req.cookies.employee_token) return res.redirect('/auth/employee-login.html');
  res.redirect('/employee/dashboard.html');
});
app.get('/admin', (req, res) => {
  if (!req.cookies.employee_token) return res.redirect('/auth/employee-login.html');
  res.redirect('/admin/dashboard.html');
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  next();
});

const PORT_LOG = `http://localhost:${PORT}`;
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  JUSTICE LAW FIRM – Dynamic Platform');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Marketing site:    ${PORT_LOG}/`);
  console.log(`  Customer login:    ${PORT_LOG}/auth/login.html`);
  console.log(`  Employee login:    ${PORT_LOG}/auth/employee-login.html`);
  console.log(`  Customer portal:   ${PORT_LOG}/portal/dashboard.html`);
  console.log(`  Employee portal:   ${PORT_LOG}/employee/dashboard.html`);
  console.log(`  Admin panel:       ${PORT_LOG}/admin/dashboard.html`);
  console.log('');
  console.log('  Default credentials:');
  console.log('    Admin:       admin@justicefirm.com / admin123');
  console.log('    Employee:    reception@justicefirm.com / password123');
  console.log('    Demo client: demo@client.com / demo1234');
  console.log('═══════════════════════════════════════════════════════════');
});
})();