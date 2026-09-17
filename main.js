/* ============================================================
   XLAND — main.js
   Renders the editable homepage text content (hero, features,
   map section) from XlandStore config, so admin edits show up
   without touching any code. Social links (nav/footer/connect)
   are handled separately by common.js via data-<platform>-link
   attributes. Runs on index.html; assumes data.js + common.js
   are already loaded.
   ============================================================ */

function xlandCopyIp() {
  const config = XlandStore.getConfig();
  const btn = document.getElementById('copy-ip-btn');
  navigator.clipboard.writeText(config.serverIp).then(() => {
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'کپی شد ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1800);
    }
    xlandToast('آی‌پی سرور کپی شد: ' + config.serverIp);
  }).catch(() => {
    xlandToast('کپی خودکار پشتیبانی نشد. آی‌پی را دستی انتخاب کنید.');
  });
}

/* Wraps the brand name (if present, any case) in a <span> so it
   keeps its accent color even though the whole heading is an
   editable string from the admin panel. Case is preserved as
   typed (e.g. "xland" stays lowercase). */
function xlandHighlightBrand(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/xland/gi, (match) => `<span>${match}</span>`);
}

function xlandRenderHero(config) {
  const ipValueEl = document.getElementById('server-ip-value');
  if (ipValueEl) ipValueEl.textContent = config.serverIp;

  const statusEl = document.getElementById('hero-status');
  if (statusEl) statusEl.textContent = config.heroStatus || '';

  const titleEl = document.getElementById('hero-title');
  if (titleEl) titleEl.innerHTML = xlandHighlightBrand(config.heroTitle || '');

  const taglineEl = document.getElementById('hero-tagline');
  if (taglineEl) taglineEl.textContent = config.tagline || '';
}

function xlandRenderFeatures(config) {
  const titleEl = document.getElementById('features-title');
  const descEl = document.getElementById('features-desc');
  if (titleEl) titleEl.textContent = config.featuresTitle || '';
  if (descEl) descEl.textContent = config.featuresDesc || '';

  const grid = document.getElementById('feature-grid');
  if (!grid) return;
  grid.innerHTML = '';
  (config.features || []).forEach(f => {
    const card = document.createElement('div');
    card.className = 'feature-card tilt-card';
    card.innerHTML = `
      <div class="feature-icon"></div>
      <h3></h3>
      <p></p>
    `;
    card.querySelector('.feature-icon').textContent = f.icon || '•';
    card.querySelector('h3').textContent = f.title || '';
    card.querySelector('p').textContent = f.desc || '';
    grid.appendChild(card);
  });

  // Phase 2/3 visual effects (effects.js) — bind tilt + cursor
  // spotlight to the cards we just created; scroll-reveal is
  // already bound at section level.
  if (typeof xlandBindTilt === 'function') xlandBindTilt(grid);
  if (typeof xlandInitSpotlight === 'function') xlandInitSpotlight(grid);
}

function xlandRenderStats(config) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  grid.innerHTML = '';
  (config.stats || []).forEach(s => {
    const card = document.createElement('div');
    card.className = 'stat-card tilt-card';
    card.innerHTML = `
      <div class="stat-number" data-target="${Number(s.value) || 0}" data-suffix="${s.suffix || ''}">0</div>
      <div class="stat-label"></div>
    `;
    card.querySelector('.stat-label').textContent = s.label || '';
    grid.appendChild(card);
  });

  if (typeof xlandBindTilt === 'function') xlandBindTilt(grid);
  if (typeof xlandInitSpotlight === 'function') xlandInitSpotlight(grid);
  if (typeof xlandInitCountUp === 'function') xlandInitCountUp(grid);
}

function xlandRenderMap(config) {
  const titleEl = document.getElementById('map-title');
  const desc1El = document.getElementById('map-desc-1');
  const desc2El = document.getElementById('map-desc-2');
  if (titleEl) titleEl.textContent = config.mapTitle || '';
  if (desc1El) desc1El.textContent = config.mapDesc1 || '';
  if (desc2El) desc2El.textContent = config.mapDesc2 || '';

  const tagsWrap = document.getElementById('map-tags');
  if (tagsWrap) {
    tagsWrap.innerHTML = '';
    (config.mapTags || []).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'map-tag';
      span.textContent = tag;
      tagsWrap.appendChild(span);
    });
  }
}

function xlandRenderHome() {
  const config = XlandStore.getConfig();
  xlandRenderHero(config);
  xlandRenderStats(config);
  xlandRenderFeatures(config);
  xlandRenderMap(config);
}

document.addEventListener('DOMContentLoaded', () => {
  xlandRenderHome();
  const copyBtn = document.getElementById('copy-ip-btn');
  if (copyBtn) copyBtn.addEventListener('click', xlandCopyIp);
});

// Live update: when data.js's Firebase listener pushes fresh config
// (e.g. the admin just changed something, possibly from another
// device), re-render the homepage immediately instead of waiting
// for the next full page reload.
window.addEventListener('xland:config-updated', xlandRenderHome);
