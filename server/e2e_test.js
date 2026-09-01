// End-to-end workflow test
const BASE = 'http://localhost:3000';

async function api(method, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const init = { method, headers };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) {
    if (opts.isForm) {
      const fd = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.body)) fd.append(k, String(v));
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = fd;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
  }
  const r = await fetch(BASE + path, init);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  const setCookie = r.headers.get('set-cookie');
  return { status: r.status, body: json, cookie: setCookie ? setCookie.split(';')[0] : opts.cookie };
}

function expect(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name} ${detail}`); process.exitCode = 1; }
}

(async () => {
  console.log('\n=== Public pages ===');
  const pages = ['/', '/about.html', '/auth/login.html', '/auth/signup.html', '/auth/employee-login.html', '/portal/dashboard.html', '/employee/dashboard.html', '/admin/dashboard.html'];
  for (const p of pages) {
    const r = await fetch(BASE + p);
    expect(`GET ${p}`, r.status === 200, `(got ${r.status})`);
  }

  console.log('\n=== Client signup + login ===');
  const newEmail = `test_${Date.now()}@example.com`;
  const su = await api('POST', '/api/auth/signup', { body: { first_name: 'Test', last_name: 'User', email: newEmail, password: 'testpass123', phone: '555-0001' } });
  expect('Signup returns 200', su.status === 200, JSON.stringify(su.body));
  expect('Signup returns token', !!su.body.token);
  expect('Signup sets cookie', !!su.cookie);
  const clientCookie = su.cookie;

  const me = await api('GET', '/api/auth/me', { cookie: clientCookie });
  expect('me returns client', me.body.type === 'client', JSON.stringify(me.body));

  console.log('\n=== Client creates a support ticket ===');
  const tk = await api('POST', '/api/tickets', { cookie: clientCookie, body: { subject: 'Test ticket', message: 'Hello, I need help.', category: 'general', priority: 'normal' } });
  expect('Ticket created', tk.status === 200, JSON.stringify(tk.body));
  expect('Ticket number assigned', /TKT-/.test(tk.body.ticket_number || ''));

  console.log('\n=== Client files asset recovery case ===');
  const fd = new FormData();
  fd.append('incident_type', 'crypto_scam');
  fd.append('scam_platform', 'FakeCoin');
  fd.append('scam_date', '2026-01-15');
  fd.append('amount_lost', '5000');
  fd.append('currency', 'USD');
  fd.append('payment_method', 'Bitcoin');
  fd.append('blockchain', 'Bitcoin');
  fd.append('has_police_report', 'on');
  fd.append('evidence_description', 'E2E test case');
  const ar = await fetch(BASE + '/api/asset-recovery/intake', { method: 'POST', body: fd, headers: { Cookie: clientCookie } });
  const arBody = await ar.json();
  expect('AR intake OK', ar.status === 200, JSON.stringify(arBody));
  expect('AR case number assigned', /AR-/.test(arBody.case_number || ''));

  console.log('\n=== Client dashboard data ===');
  const dash = await api('GET', '/api/cases', { cookie: clientCookie });
  expect('Dashboard data loaded', dash.status === 200, JSON.stringify(dash.body).slice(0, 100));
  expect('Has tickets', Array.isArray(dash.body.tickets));

  console.log('\n=== Client billing ===');
  const bill = await api('GET', '/api/billing', { cookie: clientCookie });
  expect('Billing OK', bill.status === 200);

  console.log('\n=== Client profile update ===');
  const prof = await api('PUT', '/api/me/profile', { cookie: clientCookie, body: { phone: '555-9999' } });
  expect('Profile updated', prof.status === 200);

  console.log('\n=== Employee login (receptionist) ===');
  const emp = await api('POST', '/api/auth/employee/login', { body: { email: 'reception@justicefirm.com', password: 'password123' } });
  expect('Employee login OK', emp.status === 200, JSON.stringify(emp.body));
  expect('Receptionist role', emp.body.employee?.role === 'receptionist');
  const empCookie = emp.cookie;

  const empDash = await api('GET', '/api/employee/dashboard', { cookie: empCookie });
  expect('Employee dashboard OK', empDash.status === 200, JSON.stringify(empDash.body).slice(0, 100));

  const intake = await api('GET', '/api/employee/intake', { cookie: empCookie });
  expect('Receptionist sees intake', intake.status === 200);

  console.log('\n=== Admin login ===');
  const admin = await api('POST', '/api/auth/employee/login', { body: { email: 'admin@justicefirm.com', password: 'admin123' } });
  expect('Admin login OK', admin.status === 200);
  expect('Admin role', admin.body.employee?.role === 'admin');
  const adminCookie = admin.cookie;

  const analytics = await api('GET', '/api/admin/analytics', { cookie: adminCookie });
  expect('Analytics OK', analytics.status === 200, JSON.stringify(analytics.body).slice(0, 100));
  expect('Has totals', analytics.body.totals !== undefined);

  const emps = await api('GET', '/api/admin/employees', { cookie: adminCookie });
  expect('Employees list OK', emps.status === 200);
  expect('Has at least 5 employees', emps.body.employees?.length >= 5);

  const clients = await api('GET', '/api/admin/clients', { cookie: adminCookie });
  expect('Clients list OK', clients.status === 200);

  console.log('\n=== Role access denied ===');
  const receptionistAnalytics = await api('GET', '/api/admin/analytics', { cookie: empCookie });
  expect('Receptionist blocked from analytics', receptionistAnalytics.status === 403, `(got ${receptionistAnalytics.status})`);

  console.log('\n=== Investigator login + AR queue ===');
  const inv = await api('POST', '/api/auth/employee/login', { body: { email: 'investigator@justicefirm.com', password: 'password123' } });
  expect('Investigator login OK', inv.status === 200);
  const invCookie = inv.cookie;
  const arQ = await api('GET', '/api/employee/asset-recovery', { cookie: invCookie });
  expect('Investigator sees AR queue', arQ.status === 200, JSON.stringify(arQ.body).slice(0, 100));
  expect('Has at least one AR case', arQ.body.cases?.length >= 1);

  console.log('\n=== Logout ===');
  const out = await api('POST', '/api/auth/logout', { cookie: clientCookie });
  expect('Logout OK', out.status === 200);

  console.log('\n=== Public form submission ===');
  const consult = await api('POST', '/api/forms/consultation', { body: { name: 'E2E', email: 'e2e@example.com', message: 'test', practice_area: 'Family Law' } });
  expect('Consultation submission OK', consult.status === 200);
  const contact = await api('POST', '/api/forms/contact', { body: { name: 'E2E', email: 'e2e@example.com', message: 'test', subject: 'Inquiry' } });
  expect('Contact submission OK', contact.status === 200);

  console.log('\n=== Validation ===');
  const badLogin = await api('POST', '/api/auth/login', { body: { email: 'wrong@example.com', password: 'wrongpass' } });
  expect('Bad login returns 401', badLogin.status === 401);
  const shortPwd = await api('POST', '/api/auth/signup', { body: { first_name: 'A', last_name: 'B', email: 'short@x.com', password: '123' } });
  expect('Short password rejected', shortPwd.status === 400);

  console.log('\n✅ E2E test complete.');
})();
