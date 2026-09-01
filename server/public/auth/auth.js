(function() {
  const showError = (msg) => {
    const el = document.getElementById('formError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  };
  const clearError = () => {
    const el = document.getElementById('formError');
    if (el) el.classList.remove('show');
  };
  const setLoading = (form, loading) => {
    const btn = form.querySelector('button[type=submit]');
    if (!btn) return;
    btn.disabled = loading;
    const label = btn.querySelector('.btn-label');
    if (label) label.innerHTML = loading ? '<span class="spinner"></span> Please wait...' : label.dataset.original || label.textContent;
    if (label && !label.dataset.original) label.dataset.original = label.textContent;
  };

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      setLoading(loginForm, true);
      const data = Object.fromEntries(new FormData(loginForm).entries());
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Sign in failed');
        window.location.href = '/portal/dashboard.html';
      } catch (err) {
        showError(err.message);
        setLoading(loginForm, false);
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      setLoading(signupForm, true);
      const data = Object.fromEntries(new FormData(signupForm).entries());
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Sign up failed');
        window.location.href = '/portal/dashboard.html';
      } catch (err) {
        showError(err.message);
        setLoading(signupForm, false);
      }
    });
  }

  const empLoginForm = document.getElementById('empLoginForm');
  if (empLoginForm) {
    empLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      setLoading(empLoginForm, true);
      const data = Object.fromEntries(new FormData(empLoginForm).entries());
      try {
        const res = await fetch('/api/auth/employee/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Sign in failed');
        window.location.href = body.employee.role === 'admin' ? '/admin/dashboard.html' : '/employee/dashboard.html';
      } catch (err) {
        showError(err.message);
        setLoading(empLoginForm, false);
      }
    });
  }
})();