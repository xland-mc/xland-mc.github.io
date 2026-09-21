/* ============================================================
   XLAND — admin.js
   Login is handled by Firebase Authentication (signInWithEmailAndPassword),
   configured in x89-manage-xland.html. The panel's visibility is driven
   by auth.onAuthStateChanged() at the bottom of this file. Everything
   else (products, server/socials, site content) still reads/writes
   through XlandStore, unchanged.
   NOTE: the "امنیت پنل" tab below still edits an older local
   username/password record via XlandStore — that record is no longer
   what gates access to this panel (kept only because it wasn't asked
   to be removed). See the notice inside that tab.
   Relies on xlandToast()/xlandFormatToman() from common.js, and on
   the global `auth` object created in the HTML's Firebase config block.
   ============================================================ */

let xlandEditingProductId = null;

function xlandShowPanel(user) {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('panel-view').style.display = 'block';
  const emailLabel = document.getElementById('admin-email-label');
  if (emailLabel) emailLabel.textContent = (user && user.email) || '—';
  xlandLoadServerForm();
  xlandLoadContentForm();
  xlandLoadSecurityForm();
  xlandRenderProductTable();
  xlandInitTicketsListener();
}

function xlandShowLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('panel-view').style.display = 'none';
}

/* ---------- Login (Firebase Authentication) ---------- */
function xlandInitLogin() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const notRobot = document.getElementById('not-robot').checked;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!notRobot) {
      errorBox.textContent = 'لطفاً تیک «من ربات نیستم» را بزنید.';
      errorBox.classList.add('show');
      return;
    }

    submitBtn.disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      errorBox.classList.remove('show');
      errorBox.textContent = '';
      form.reset();
      // auth.onAuthStateChanged (registered below) takes care of
      // switching the view to the panel once sign-in succeeds.
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
    // onAuthStateChanged will switch the view back to the login form.
  });
}

/* ---------- Tabs ---------- */
function xlandInitTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- Products (add, edit, delete) ---------- */
function xlandRenderProductTable() {
  const products = XlandStore.getProducts();
  const tbody = document.getElementById('product-table-body');
  const emptyMsg = document.getElementById('no-products-msg');
  tbody.innerHTML = '';

  if (products.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  products.forEach(p => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = p.name;

    const priceTd = document.createElement('td');
    priceTd.textContent = xlandFormatToman(p.price);

    const descTd = document.createElement('td');
    descTd.textContent = p.description || '—';
    descTd.style.maxWidth = '260px';
    descTd.style.color = 'var(--text-dim)';

    const actionsTd = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = 'ویرایش';
    editBtn.addEventListener('click', () => xlandStartEditProduct(p));

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', () => {
      if (confirm(`حذف «${p.name}» از فروشگاه؟`)) {
        if (xlandEditingProductId === p.id) xlandCancelEditProduct();
        XlandStore.deleteProduct(p.id);
        xlandRenderProductTable();
        xlandToast('محصول حذف شد.');
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    actionsTd.appendChild(actions);

    tr.appendChild(nameTd);
    tr.appendChild(priceTd);
    tr.appendChild(descTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

function xlandStartEditProduct(p) {
  xlandEditingProductId = p.id;
  document.getElementById('p-name').value = p.name || '';
  document.getElementById('p-price').value = p.price || '';
  document.getElementById('p-desc').value = p.description || '';
  document.getElementById('p-image').value = p.image || '';
  document.getElementById('p-buylink').value = p.buyLink || '';
  document.getElementById('product-form-title').textContent = 'ویرایش محصول: ' + p.name;
  document.getElementById('product-submit-btn').textContent = 'ذخیره تغییرات محصول';
  document.getElementById('product-cancel-btn').style.display = 'inline-flex';
  document.getElementById('product-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function xlandCancelEditProduct() {
  xlandEditingProductId = null;
  document.getElementById('product-form').reset();
  document.getElementById('product-form-title').textContent = 'افزودن محصول جدید';
  document.getElementById('product-submit-btn').textContent = 'افزودن به فروشگاه';
  document.getElementById('product-cancel-btn').style.display = 'none';
}

function xlandInitProductForm() {
  const form = document.getElementById('product-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('p-name').value.trim();
    const price = document.getElementById('p-price').value.trim().replace(/[^\d]/g, '');
    const description = document.getElementById('p-desc').value.trim();
    const image = document.getElementById('p-image').value.trim();
    const buyLink = xlandSanitizeUrl(document.getElementById('p-buylink').value.trim());

    if (!name || !price) {
      xlandToast('نام و قیمت محصول الزامی است.');
      return;
    }

    if (xlandEditingProductId) {
      XlandStore.updateProduct(xlandEditingProductId, { name, price: Number(price), description, image, buyLink });
      xlandToast('محصول به‌روزرسانی شد.');
      xlandCancelEditProduct();
    } else {
      XlandStore.addProduct({ name, price: Number(price), description, image, buyLink });
      xlandToast('محصول به فروشگاه اضافه شد.');
      form.reset();
    }
    xlandRenderProductTable();
  });

  document.getElementById('product-cancel-btn').addEventListener('click', xlandCancelEditProduct);
}

/* ---------- Server & socials ---------- */
function xlandLoadServerForm() {
  const config = XlandStore.getConfig();
  document.getElementById('s-ip').value = config.serverIp || '';
  XLAND_SOCIAL_KEYS.forEach(key => {
    const input = document.getElementById('s-' + key);
    if (input) input.value = (config.socials && config.socials[key]) || '';
  });
}

function xlandInitServerForm() {
  const form = document.getElementById('server-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const socials = {};
    XLAND_SOCIAL_KEYS.forEach(key => {
      const input = document.getElementById('s-' + key);
      if (input) socials[key] = xlandSanitizeUrl(input.value.trim());
    });
    XlandStore.saveConfig({ serverIp: document.getElementById('s-ip').value.trim() });
    XlandStore.saveSocials(socials);
    xlandToast('تنظیمات سرور و شبکه‌های اجتماعی ذخیره شد.');
  });
}

/* ---------- Site content (titles, map, features) ---------- */
function xlandLoadContentForm() {
  const config = XlandStore.getConfig();
  document.getElementById('c-hero-status').value = config.heroStatus || '';
  document.getElementById('c-hero-title').value = config.heroTitle || '';
  document.getElementById('c-tagline').value = config.tagline || '';
  document.getElementById('c-features-title').value = config.featuresTitle || '';
  document.getElementById('c-features-desc').value = config.featuresDesc || '';

  (config.features || []).forEach((f, i) => {
    const n = i + 1;
    const titleInput = document.getElementById('c-feature-' + n + '-title');
    const descInput = document.getElementById('c-feature-' + n + '-desc');
    if (titleInput) titleInput.value = f.title || '';
    if (descInput) descInput.value = f.desc || '';
  });

  document.getElementById('c-map-title').value = config.mapTitle || '';
  document.getElementById('c-map-desc-1').value = config.mapDesc1 || '';
  document.getElementById('c-map-desc-2').value = config.mapDesc2 || '';
  document.getElementById('c-map-tags').value = (config.mapTags || []).join('، ');

  (config.stats || []).forEach((s, i) => {
    const n = i + 1;
    const labelInput = document.getElementById('c-stat-' + n + '-label');
    const valueInput = document.getElementById('c-stat-' + n + '-value');
    if (labelInput) labelInput.value = s.label || '';
    if (valueInput) valueInput.value = s.value || 0;
  });
}

function xlandInitContentForm() {
  const form = document.getElementById('content-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const features = [1, 2, 3, 4].map(n => ({
      title: document.getElementById('c-feature-' + n + '-title').value.trim(),
      desc: document.getElementById('c-feature-' + n + '-desc').value.trim()
    }));

    const currentFeatures = XlandStore.getConfig().features || [];
    const mergedFeatures = features.map((f, i) => ({
      icon: (currentFeatures[i] && currentFeatures[i].icon) || '',
      title: f.title,
      desc: f.desc
    }));

    const mapTags = document.getElementById('c-map-tags').value
      .split(/[,،]/)
      .map(t => t.trim())
      .filter(Boolean);

    const currentStats = XlandStore.getConfig().stats || [];
    const stats = [1, 2, 3, 4].map(n => ({
      label: document.getElementById('c-stat-' + n + '-label').value.trim(),
      value: Number(document.getElementById('c-stat-' + n + '-value').value.replace(/[^\d.-]/g, '')) || 0,
      suffix: (currentStats[n - 1] && currentStats[n - 1].suffix) || ''
    }));

    XlandStore.saveConfig({
      heroStatus: document.getElementById('c-hero-status').value.trim(),
      heroTitle: document.getElementById('c-hero-title').value.trim(),
      tagline: document.getElementById('c-tagline').value.trim(),
      featuresTitle: document.getElementById('c-features-title').value.trim(),
      featuresDesc: document.getElementById('c-features-desc').value.trim(),
      features: mergedFeatures,
      mapTitle: document.getElementById('c-map-title').value.trim(),
      mapDesc1: document.getElementById('c-map-desc-1').value.trim(),
      mapDesc2: document.getElementById('c-map-desc-2').value.trim(),
      mapTags: mapTags,
      stats: stats
    });

    xlandToast('محتوای سایت به‌روزرسانی شد.');
  });
}

/* ---------- Security ---------- */
function xlandLoadSecurityForm() {
  const admin = XlandStore.getAdmin();
  document.getElementById('sec-username').value = admin.username || '';
}

function xlandInitSecurityForm() {
  const form = document.getElementById('security-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('sec-username').value.trim();
    const password = document.getElementById('sec-password').value;
    if (!username || !password) {
      xlandToast('نام کاربری و رمز عبور جدید را وارد کنید.');
      return;
    }
    await XlandStore.saveAdmin({ username, password });
    document.getElementById('sec-password').value = '';
    xlandToast('اطلاعات ورود به‌روزرسانی شد (رمز به‌صورت هش‌شده ذخیره شد).');
  });
}

/* ---------- Tickets (from the public site's ticket form) ---------- */
let xlandTicketsBound = false;

function xlandFormatTicketTime(ms) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString('fa-IR');
  } catch (e) {
    return '';
  }
}

function xlandRenderTickets(ticketsObj) {
  const tbody = document.getElementById('ticket-table-body');
  const emptyMsg = document.getElementById('no-tickets-msg');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Object.entries(ticketsObj || {}).sort((a, b) => (b[1].time || 0) - (a[1].time || 0));

  if (entries.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  entries.forEach(([key, t]) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = t.name || '—';

    const contactTd = document.createElement('td');
    contactTd.style.fontSize = '13px';
    contactTd.style.color = 'var(--text-dim)';
    contactTd.textContent = [t.email, t.phone].filter(Boolean).join(' · ') || '—';

    const msgTd = document.createElement('td');
    msgTd.textContent = t.message || '';
    msgTd.style.maxWidth = '320px';
    msgTd.style.color = 'var(--text-dim)';

    const timeTd = document.createElement('td');
    timeTd.style.fontSize = '12.5px';
    timeTd.style.color = 'var(--text-faint)';
    timeTd.textContent = xlandFormatTicketTime(t.time);

    const actionsTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', () => {
      if (confirm('این تیکت حذف شود؟')) {
        database.ref('tickets/' + key).remove();
        xlandToast('تیکت حذف شد.');
      }
    });
    actionsTd.appendChild(delBtn);

    tr.appendChild(nameTd);
    tr.appendChild(contactTd);
    tr.appendChild(msgTd);
    tr.appendChild(timeTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

function xlandInitTicketsListener() {
  if (xlandTicketsBound || typeof database === 'undefined') return;
  xlandTicketsBound = true;
  database.ref('tickets').on('value', (snapshot) => {
    xlandRenderTickets(snapshot.val());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  xlandInitLogin();
  xlandInitTabs();
  xlandInitProductForm();
  xlandInitServerForm();
  xlandInitContentForm();
  xlandInitSecurityForm();

  // Firebase drives the login gate: fires once immediately with the
  // persisted session (or null), then again on every sign-in/sign-out.
  // IMPORTANT: being signed in is not enough — since visitors can now
  // also register/log in on the public site (same Firebase project),
  // we additionally check the "admins" allow-list in the database.
  // Only UIDs manually added there (via Firebase Console, never from
  // client code) are let into the panel.
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      xlandShowLogin();
      return;
    }
    try {
      const snap = await database.ref('admins/' + user.uid).once('value');
      if (snap.val() === true) {
        xlandShowPanel(user);
      } else {
        await auth.signOut();
        xlandShowLogin();
        const errorBox = document.getElementById('login-error');
        if (errorBox) {
          errorBox.textContent = 'این حساب دسترسی مدیریت ندارد.';
          errorBox.classList.add('show');
        }
      }
    } catch (e) {
      await auth.signOut();
      xlandShowLogin();
    }
  });
});
