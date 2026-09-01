const API_BASE = '/api';

const Portal = {
  user: null,

  async init({ expectedType = null, redirect = '/auth/login.html' } = {}) {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      if (redirect) window.location.href = redirect;
      return null;
    }
    const data = await res.json();
    this.user = data;
    if (expectedType && data.type !== expectedType) {
      if (data.type === 'client') window.location.href = '/portal/dashboard.html';
      else window.location.href = '/employee/dashboard.html';
      return null;
    }
    return data;
  },

  async api(path, options = {}) {
    const opts = { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options };
    if (options.body && typeof options.body !== 'string') opts.body = JSON.stringify(options.body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  async logout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/auth/login.html';
  },

  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4500);
  },

  fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d.replace(' ', 'T') + (String(d).endsWith('Z') ? '' : 'Z'));
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d.replace(' ', 'T') + (String(d).endsWith('Z') ? '' : 'Z'));
    if (isNaN(dt)) return d;
    return dt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  fmtMoney(amount, currency = 'USD') {
    const n = Number(amount || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  },

  initials(user) {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  },

  statusBadge(status) {
    const map = {
      open: 'badge-blue', in_progress: 'badge-gold', pending_client: 'badge-yellow', review: 'badge-purple',
      closed: 'badge-gray', won: 'badge-green', lost: 'badge-red',
      resolved: 'badge-green', waiting: 'badge-yellow', paid: 'badge-green', pending: 'badge-yellow',
      overdue: 'badge-red', cancelled: 'badge-gray', refunded: 'badge-gray',
      active: 'badge-green', suspended: 'badge-yellow', disabled: 'badge-red',
      submitted: 'badge-blue', under_review: 'badge-gold', evidence_gathering: 'badge-purple',
      tracing: 'badge-purple', recovery_action: 'badge-yellow', recovered: 'badge-green',
      unrecoverable: 'badge-red', new: 'badge-blue', contacted: 'badge-gold', qualified: 'badge-purple',
      converted: 'badge-green', read: 'badge-gray', replied: 'badge-green', archived: 'badge-gray',
    };
    const cls = map[status] || 'badge-gray';
    return `<span class="badge ${cls}">${status.replace(/_/g, ' ')}</span>`;
  },

  priorityBadge(priority) {
    const map = { low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red' };
    return `<span class="badge ${map[priority] || 'badge-gray'}">${priority}</span>`;
  }
};

function buildSidebar(activeKey, role = 'client') {
  const isEmp = role === 'employee';
  const admin = role === 'admin';
  const items = isEmp
    ? [
        { section: 'OVERVIEW' },
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high', href: '/employee/dashboard.html' },
        { section: 'WORK' },
        { key: 'cases', label: 'Cases', icon: 'fa-folder-open', href: '/employee/cases.html' },
        { key: 'tickets', label: 'Support Tickets', icon: 'fa-life-ring', href: '/employee/tickets.html' },
        { key: 'asset', label: 'Asset Recovery', icon: 'fa-shield-halved', href: '/employee/asset-recovery.html' },
        ...(admin ? [
          { section: 'ADMIN' },
          { key: 'intake', label: 'Intake Submissions', icon: 'fa-inbox', href: '/employee/intake.html' },
          { key: 'analytics', label: 'Analytics', icon: 'fa-chart-line', href: '/admin/dashboard.html' },
          { key: 'employees', label: 'Employees', icon: 'fa-user-tie', href: '/admin/employees.html' },
          { key: 'clients', label: 'Clients', icon: 'fa-users', href: '/admin/clients.html' },
        ] : [])
      ]
    : [
        { section: 'OVERVIEW' },
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high', href: '/portal/dashboard.html' },
        { section: 'MY ACCOUNT' },
        { key: 'cases', label: 'My Cases', icon: 'fa-folder-open', href: '/portal/cases.html' },
        { key: 'tickets', label: 'Support Tickets', icon: 'fa-life-ring', href: '/portal/tickets.html' },
        { key: 'asset', label: 'Asset Recovery', icon: 'fa-shield-halved', href: '/portal/asset-recovery.html' },
        { key: 'billing', label: 'Billing & Invoices', icon: 'fa-file-invoice-dollar', href: '/portal/billing.html' },
        { key: 'profile', label: 'Profile & Settings', icon: 'fa-user-gear', href: '/portal/profile.html' },
      ];

  const user = Portal.user?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  const roleLabel = isEmp
    ? (admin ? 'Administrator' : (user.role || 'employee').replace(/_/g, ' '))
    : 'Client';

  return `
    <aside class="sidebar" id="sidebar">
      <a href="/" class="sidebar-brand">
        <div class="logo-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="logo-text">
          <span class="logo-title">JUSTICE</span>
          <span class="logo-sub">LAW FIRM</span>
        </div>
      </a>
      <div class="sidebar-user">
        <div class="avatar" style="background:${user.avatar_color || 'linear-gradient(135deg,#c9a84c,#8a6520)'}">${Portal.initials(user)}</div>
        <div class="user-meta">
          <span class="user-name">${name}</span>
          <span class="user-role">${roleLabel}</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${items.map(item => {
          if (item.section) return `<div class="nav-section">${item.section}</div>`;
          return `<a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
            <i class="fas ${item.icon}"></i><span>${item.label}</span>
          </a>`;
        }).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="Portal.logout()">
          <i class="fas fa-sign-out-alt"></i> Sign out
        </button>
      </div>
    </aside>
  `;
}

function buildTopbar(title) {
  return `
    <header class="topbar">
      <button class="notif-btn" onclick="document.getElementById('sidebar').classList.toggle('open')" style="margin-right:8px"><i class="fas fa-bars"></i></button>
      <h1>${title}</h1>
      <div class="topbar-actions">
        <a href="/" class="btn btn-sm btn-ghost" title="Visit public site">
          <i class="fas fa-external-link-alt"></i> Public Site
        </a>
      </div>
    </header>
  `;
}

function renderShell({ activeKey, title, role = 'client', body }) {
  document.body.innerHTML = `
    <div class="app">
      ${buildSidebar(activeKey, role)}
      <div class="main">
        ${buildTopbar(title)}
        <div class="content" id="pageContent">${body}</div>
      </div>
    </div>
  `;
  bindCommon();
}

function bindCommon() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}