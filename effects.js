/* ============================================================
   XLAND — effects.js  (Phase 2: visual layer only)
   Three independent, purely cosmetic systems:
     1. Particle canvas background (mouse + scroll reactive)
     2. 3D tilt on .tilt-card elements (mouse-driven)
     3. Scroll-driven reveal (zoom + fade) on .reveal elements
   None of this touches XlandStore, auth, or any stored data —
   it only reads config.serverStatus-free content already in the
   DOM and reacts to cursor/scroll. Safe to include on any page.
   Respects prefers-reduced-motion and disables mouse-only effects
   on touch devices.
   ============================================================ */

const XLAND_REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const XLAND_HAS_FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- 1. Particle canvas ---------- */
function xlandInitParticles(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, particles = [];
  let mouseX = -9999, mouseY = -9999;
  let scrollY = window.scrollY || 0;
  let rafId = null;

  const COLORS = ['232,150,58', '53,230,200']; // amber, cyan

  function countForViewport() {
    if (XLAND_REDUCE_MOTION) return 0;
    const area = window.innerWidth * window.innerHeight;
    const base = Math.max(18, Math.min(60, Math.round(area / 22000)));
    // Phase 3: lighten this effect further on small/mobile screens.
    return window.innerWidth < 640 ? Math.min(base, 20) : base;
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function seedParticles() {
    const count = countForViewport();
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.6 + 0.6,
      color: COLORS[Math.random() > 0.5 ? 1 : 0]
    }));
  }

  resize();
  seedParticles();
  window.addEventListener('resize', () => { resize(); seedParticles(); });

  if (XLAND_HAS_FINE_POINTER) {
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });
  }
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  function drawStatic() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.color}, 0.4)`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function tick() {
    if (document.hidden) { rafId = requestAnimationFrame(tick); return; }
    ctx.clearRect(0, 0, w, h);

    particles.forEach(p => {
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110 && dist > 0.01) {
        const force = ((110 - dist) / 110) * 0.05;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;

      // gentle scroll-driven vertical drift
      const drawY = (p.y + scrollY * 0.015) % (h + 20);
      const finalY = drawY < 0 ? drawY + h + 20 : drawY;

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.color}, 0.5)`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${p.color}, 0.7)`;
      ctx.arc(p.x, finalY, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    rafId = requestAnimationFrame(tick);
  }

  if (XLAND_REDUCE_MOTION) {
    drawStatic();
  } else {
    rafId = requestAnimationFrame(tick);
  }
}

/* ---------- 2. 3D tilt cards ---------- */
function xlandBindTilt(root) {
  if (!XLAND_HAS_FINE_POINTER) return;
  const scope = root || document;
  scope.querySelectorAll('.tilt-card:not([data-tilt-bound])').forEach(card => {
    card.dataset.tiltBound = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 12;
      const rotateX = (0.5 - py) * 12;
      card.style.transform =
        `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ---------- 3. Scroll-driven reveal ---------- */
function xlandInitScrollReveal(root) {
  const scope = root || document;
  const els = scope.querySelectorAll('.reveal:not([data-reveal-bound])');
  if (!els.length) return;

  if (!('IntersectionObserver' in window) || XLAND_REDUCE_MOTION) {
    els.forEach(el => { el.dataset.revealBound = '1'; el.classList.add('in-view'); });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => { el.dataset.revealBound = '1'; observer.observe(el); });
}

/* ============================================================
   Phase 3 — polishing & micro-interactions (additive only;
   nothing above this line was changed except the mobile particle
   cap in countForViewport(), per Phase 3 requirement #4).
   ============================================================ */

/* ---------- 4. Cursor spotlight on glass cards ---------- */
function xlandInitSpotlight(root) {
  if (!XLAND_HAS_FINE_POINTER) return;
  const scope = root || document;
  scope.querySelectorAll('.tilt-card:not([data-spotlight-bound])').forEach(card => {
    card.dataset.spotlightBound = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--spot-x', px + '%');
      card.style.setProperty('--spot-y', py + '%');
    });
  });
}

/* ---------- 5. Scroll progress indicator ---------- */
function xlandInitScrollProgress(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;

  function update() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* ---------- 6. Count-up stat numbers ---------- */
function xlandAnimateCount(el) {
  const target = parseFloat(el.dataset.target || '0');
  const suffix = el.dataset.suffix || '';
  const duration = 1400;

  if (XLAND_REDUCE_MOTION) {
    el.textContent = target.toLocaleString('fa-IR') + suffix;
    return;
  }

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const value = Math.round(target * eased);
    el.textContent = value.toLocaleString('fa-IR') + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function xlandInitCountUp(root) {
  const scope = root || document;
  const els = scope.querySelectorAll('.stat-number[data-target]:not([data-count-bound])');
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach(el => { el.dataset.countBound = '1'; xlandAnimateCount(el); });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        xlandAnimateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  els.forEach(el => { el.dataset.countBound = '1'; observer.observe(el); });
}

document.addEventListener('DOMContentLoaded', () => {
  xlandInitParticles('xland-particles');
  xlandBindTilt();
  xlandInitScrollReveal();

  // Phase 3
  xlandInitSpotlight();
  xlandInitScrollProgress('xland-scroll-progress');
  xlandInitCountUp();
});
