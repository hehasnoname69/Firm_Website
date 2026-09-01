/* ============================================================
   JUSTICE LAW FIRM – Enhanced Dynamic JavaScript v2
============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════════════════════
     1. PARTICLES CANVAS
  ══════════════════════════════════════════════ */
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.6 ? '#c9a84c' : '#ffffff';
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function initParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 14000);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#c9a84c';
          ctx.globalAlpha = (1 - dist / 100) * 0.08;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animateParticles);
  }

  initParticles();
  animateParticles();

  /* ══════════════════════════════════════════════
     2. TYPED TEXT EFFECT (Hero)
  ══════════════════════════════════════════════ */
  const typedEl = document.getElementById('typedText');
  const phrases = ['On Your Side', 'Fighting For You', 'Your Best Defense', 'Justice Delivered'];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typeDelay = 120;

  function typeEffect() {
    const current = phrases[phraseIndex];
    if (isDeleting) {
      typedEl.textContent = current.substring(0, charIndex - 1);
      charIndex--;
      typeDelay = 60;
    } else {
      typedEl.textContent = current.substring(0, charIndex + 1);
      charIndex++;
      typeDelay = 120;
    }
    if (!isDeleting && charIndex === current.length) {
      typeDelay = 2200;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typeDelay = 400;
    }
    setTimeout(typeEffect, typeDelay);
  }
  setTimeout(typeEffect, 800);

  /* ══════════════════════════════════════════════
     3. HERO STATS COUNTER
  ══════════════════════════════════════════════ */
  const statNums = document.querySelectorAll('.stat-num');
  let heroStatsAnimated = false;

  function animateHeroStats() {
    if (heroStatsAnimated) return;
    heroStatsAnimated = true;
    statNums.forEach(el => {
      const target = parseInt(el.getAttribute('data-target'));
      const duration = 2000;
      const start = performance.now();
      function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    });
  }

  /* ══════════════════════════════════════════════
     4. NAVBAR SCROLL
  ══════════════════════════════════════════════ */
  const navbar = document.getElementById('navbar');
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    navbar.classList.toggle('scrolled', sy > 60);
    updateActiveNav(sy);
    toggleBackToTop(sy);
    if (sy > 200) animateHeroStats();
  });

  function updateActiveNav(sy) {
    let current = '';
    sections.forEach(s => {
      if (sy >= s.offsetTop - 120) current = s.getAttribute('id');
    });
    navLinks.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === `#${current}`) l.classList.add('active');
    });
  }

  /* ══════════════════════════════════════════════
     5. HAMBURGER / MOBILE MENU
  ══════════════════════════════════════════════ */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    const icon = hamburger.querySelector('i');
    icon.className = open ? 'fas fa-times' : 'fas fa-bars';
  });

  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.querySelector('i').className = 'fas fa-bars';
    });
  });

  /* ══════════════════════════════════════════════
     6. TESTIMONIALS — pure CSS marquee (no JS needed)
     Hover-pause is handled by:
       .marquee-outer:hover .marquee-track { animation-play-state: paused; }
     The two tracks (marqueeTrack1 / marqueeTrack2) each contain
     the same set of cards duplicated in HTML so the loop is seamless.
  ══════════════════════════════════════════════ */
  // (marquee is CSS-only — nothing to init here)

  /* ══════════════════════════════════════════════
     7. FAQ ACCORDION
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    const ans = item.querySelector('.faq-answer');
    btn.addEventListener('click', () => {
      const wasOpen = btn.classList.contains('open');
      document.querySelectorAll('.faq-question.open').forEach(b => {
        b.classList.remove('open');
        b.nextElementSibling.classList.remove('open');
      });
      if (!wasOpen) { btn.classList.add('open'); ans.classList.add('open'); }
    });
  });

  /* ══════════════════════════════════════════════
     8. SCROLL REVEAL
  ══════════════════════════════════════════════ */
  // Add reveal classes dynamically
  const revealMap = [
    ['.practice-card',    'reveal'],
    ['.attorney-card',    'reveal'],
    ['.result-item',      'reveal'],
    ['.blog-card',        'reveal'],
    ['.trust-item',       'reveal'],
    ['.contact-card',     'reveal'],
    ['.section-title',    'reveal'],
    ['.section-eyebrow',  'reveal'],
    ['.attorneys-cta',    'reveal-right'],
    ['.consultation-left','reveal-left'],
    ['.consultation-right','reveal-right'],
    ['.contact-map',      'reveal-left'],
    ['.contact-form-wrap','reveal-right'],
  ];

  revealMap.forEach(([selector, cls]) => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add(cls);
      el.style.transitionDelay = `${(i % 6) * 80}ms`;
    });
  });

  const revealObserver = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } }),
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => revealObserver.observe(el));

  /* ══════════════════════════════════════════════
     9. COUNT-UP (Case Results)
  ══════════════════════════════════════════════ */
  const countEls = document.querySelectorAll('.count-up');

  const countObserver = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); countObserver.unobserve(e.target); } }),
    { threshold: 0.5 }
  );

  function animateCount(el) {
    const target = +el.dataset.target;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();

    function update(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      let display;
      if (target >= 1000000) display = (val / 1000000).toFixed(1);
      else if (target >= 1000) display = (val / 1000).toFixed(0) + ',000';
      else display = Math.round(val).toString();
      el.textContent = prefix + display + suffix;
      if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }
  countEls.forEach(el => countObserver.observe(el));

  /* ══════════════════════════════════════════════
     10. CONSULTATION FORM
  ══════════════════════════════════════════════ */
  const consultForm = document.getElementById('consultForm');
  const formSuccess = document.getElementById('formSuccess');

  if (consultForm) {
    consultForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = consultForm.querySelector('.btn-gold');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      btn.style.opacity = '0.7';
      btn.disabled = true;
      const fd = new FormData(consultForm);
      const payload = {
        name: fd.get('Full Name') || fd.get('name'),
        email: fd.get('Email Address') || fd.get('email'),
        phone: fd.get('Phone Number') || fd.get('phone'),
        practice_area: fd.get('Practice Area') || fd.get('practice_area'),
        message: fd.get('Tell us about your case...') || fd.get('message')
      };
      try {
        const res = await fetch('/api/forms/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send');
        consultForm.reset();
        btn.innerHTML = originalHTML;
        btn.style.opacity = '';
        btn.disabled = false;
        formSuccess.classList.add('show');
        setTimeout(() => formSuccess.classList.remove('show'), 6000);
      } catch (err) {
        btn.innerHTML = originalHTML;
        btn.style.opacity = '';
        btn.disabled = false;
        alert('Could not submit: ' + err.message);
      }
    });
  }

  /* ══════════════════════════════════════════════
     11. CONTACT FORM
  ══════════════════════════════════════════════ */
  const contactForm = document.getElementById('contactForm');
  const contactSuccess = document.getElementById('contactFormSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = contactForm.querySelector('.btn-gold');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      btn.style.opacity = '0.7';
      btn.disabled = true;
      const fd = new FormData(contactForm);
      const payload = {
        name: fd.get('Your Full Name') || fd.get('name'),
        email: fd.get('Your Email Address') || fd.get('email'),
        phone: fd.get('Phone Number') || fd.get('phone'),
        subject: fd.get('Subject') || fd.get('subject'),
        message: fd.get('Your Message...') || fd.get('message')
      };
      try {
        const res = await fetch('/api/forms/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send');
        contactForm.reset();
        btn.innerHTML = originalHTML;
        btn.style.opacity = '';
        btn.disabled = false;
        contactSuccess.classList.add('show');
        setTimeout(() => contactSuccess.classList.remove('show'), 6000);
      } catch (err) {
        btn.innerHTML = originalHTML;
        btn.style.opacity = '';
        btn.disabled = false;
        alert('Could not submit: ' + err.message);
      }
    });
  }

  /* ══════════════════════════════════════════════
     12. NEWSLETTER FORM
  ══════════════════════════════════════════════ */
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', e => {
      e.preventDefault();
      const btn = newsletterForm.querySelector('button');
      btn.textContent = '✓ SUBSCRIBED!';
      btn.style.background = '#2e7d32';
      newsletterForm.querySelector('input').value = '';
      setTimeout(() => { btn.textContent = 'SUBSCRIBE'; btn.style.background = ''; }, 4000);
    });
  }

  /* ══════════════════════════════════════════════
     13. BACK TO TOP
  ══════════════════════════════════════════════ */
  const backToTop = document.getElementById('backToTop');

  function toggleBackToTop(sy) {
    backToTop.classList.toggle('visible', sy > 400);
  }
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ══════════════════════════════════════════════
     14. SMOOTH ANCHOR SCROLL (offset for navbar)
  ══════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - navbar.offsetHeight - 6;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ══════════════════════════════════════════════
     15. PRACTICE CARD TILT EFFECT (subtle 3D)
  ══════════════════════════════════════════════ */
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      card.style.transform = `translateY(-10px) rotateX(${-dy * 5}deg) rotateY(${dx * 5}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  /* ══════════════════════════════════════════════
     16. CHAT BUBBLE
  ══════════════════════════════════════════════ */
  const chatBtn = document.getElementById('chatBtn');
  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      window.location.href = '#contact-section';
    });
  }

  /* ══════════════════════════════════════════════
     17. NAVBAR HIDE/SHOW ON SCROLL DIRECTION
  ══════════════════════════════════════════════ */
  let lastScrollY = 0;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    if (sy > 200) {
      if (sy > lastScrollY + 5) {
        navbar.style.transform = 'translateY(-100%)';
      } else if (lastScrollY > sy + 5) {
        navbar.style.transform = 'translateY(0)';
      }
    } else {
      navbar.style.transform = 'translateY(0)';
    }
    lastScrollY = sy;
  }, { passive: true });

  /* ══════════════════════════════════════════════
     18. CONTACT CARDS SEQUENTIAL REVEAL
  ══════════════════════════════════════════════ */
  const contactCards = document.querySelectorAll('.contact-card');
  const cardObserver = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        const delay = +e.target.dataset.delay || 0;
        setTimeout(() => e.target.classList.add('visible'), delay);
        cardObserver.unobserve(e.target);
      }
    }),
    { threshold: 0.15 }
  );
  contactCards.forEach(c => cardObserver.observe(c));

  /* ══════════════════════════════════════════════
     19. INPUT FOCUS LABEL EFFECT
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.input-wrap input, .input-wrap textarea, .input-wrap select').forEach(el => {
    el.addEventListener('focus', () => el.closest('.input-wrap').classList.add('focused'));
    el.addEventListener('blur',  () => el.closest('.input-wrap').classList.remove('focused'));
  });

  /* ══════════════════════════════════════════════
     20. HERO PARALLAX ON MOUSE MOVE
  ══════════════════════════════════════════════ */
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    heroSection.addEventListener('mousemove', e => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const mx = (clientX / innerWidth - 0.5) * 12;
      const my = (clientY / innerHeight - 0.5) * 8;
      const shapes = heroSection.querySelectorAll('.shape');
      shapes.forEach((s, i) => {
        const factor = (i + 1) * 0.4;
        s.style.transform = `translate(${mx * factor}px, ${my * factor}px)`;
      });
    });
  }

});
