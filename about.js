/* ============================================================
   JUSTICE LAW FIRM – about.js
   Page-specific JS for about.html
============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Scroll reveal ── */
  const revealMap = [
    ['.ab-practice-item',  'reveal'],
    ['.ab-lawyer-card',    'reveal'],
    ['.value-card',        'reveal'],
    ['.pillar',            'reveal'],
    ['.story-accent-box',  'reveal'],
    ['.story-img-frame',   'reveal-left'],
    ['.firm-story-text-col','reveal-right'],
  ];
  revealMap.forEach(([sel, cls]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add(cls);
      el.style.transitionDelay = `${(i % 4) * 90}ms`;
    });
  });
  const obs = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => obs.observe(el));

  /* ── Hero stats counter ── */
  const statsAnimated = { done: false };
  const statEls = document.querySelectorAll('.ahs-num');

  function runStats() {
    if (statsAnimated.done) return;
    statsAnimated.done = true;
    statEls.forEach(el => {
      const target = +el.dataset.target;
      const dur = 2200;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  const heroObs = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) runStats(); }),
    { threshold: 0.3 }
  );
  const heroStats = document.querySelector('.about-hero-stats');
  if (heroStats) heroObs.observe(heroStats);

  /* ── Back to top ── */
  const btn = document.getElementById('backToTop');
  if (btn) {
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ── Hamburger ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.querySelector('i').className = open ? 'fas fa-times' : 'fas fa-bars';
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.querySelector('i').className = 'fas fa-bars';
      });
    });
  }

  /* ── Newsletter ── */
  const nf = document.getElementById('newsletterForm');
  if (nf) {
    nf.addEventListener('submit', e => {
      e.preventDefault();
      const btn = nf.querySelector('button');
      btn.textContent = '✓ SUBSCRIBED!';
      btn.style.background = '#2e7d32';
      nf.querySelector('input').value = '';
      setTimeout(() => { btn.textContent = 'SUBSCRIBE'; btn.style.background = ''; }, 4000);
    });
  }

  /* ── Hash scroll on load (e.g. about.html#ip-law) ── */
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => {
        const offset = 84;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }, 350);
    }
  }

  /* ── Smooth anchor scroll ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 84;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ── Navbar hide/show on scroll direction ── */
  const navbar = document.getElementById('navbar');
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    if (sy > 200) {
      navbar.style.transform = sy > lastY + 5 ? 'translateY(-100%)' : lastY > sy + 5 ? 'translateY(0)' : navbar.style.transform;
    } else {
      navbar.style.transform = 'translateY(0)';
    }
    lastY = sy;
  }, { passive: true });

});
