/* ============================================================
   XLAND — data.js
   Firebase Realtime Database + LocalStorage fallback layer.

   NOTE (Claude): originally the user-supplied version, with these
   additive/bugfix changes since:
     1. A `stats` array added to XLAND_DEFAULTS.config, needed by
        the Phase 3 count-up stats section (same pattern as the
        existing `features` array).
     2. Each Firebase `.on('value', ...)` listener also dispatches a
        `window` CustomEvent ('xland:config-updated' /
        'xland:products-updated') after refreshing localStorage, so
        a page that's already open can re-render live instead of
        only picking up new data on the next full reload.
     3. CRITICAL FIX: init()'s bootstrap/merge step used to call
        _write(), which also pushes to Firebase — so simply loading
        any page (with empty/stale localStorage) would silently
        overwrite the shared Firebase data with local defaults,
        making admin changes appear to "reset" on refresh. Bootstrap
        now uses a new _writeLocal() that only touches localStorage;
        only explicit admin-panel saves (saveConfig/saveProducts/
        addProduct/etc., which still call _write()) ever write to
        Firebase.
   All existing method names/signatures are unchanged.
   ============================================================ */

const XLAND_KEYS = {
  CONFIG: 'xland_config',
  PRODUCTS: 'xland_products',
  ADMIN: 'xland_admin',
  SESSION: 'xland_admin_session'
};

const XLAND_DEFAULTS = {
  config: {
    serverIp: 'play.Xland.ir',
    serverName: 'XLAND',

    socials: {
      discord: 'https://discord.gg/xland',
      telegram: '',
      rubika: '',
      youtube: '',
      aparat: ''
    },

    heroStatus: 'سرور در حال ساخت است',
    heroTitle: 'وارد جبهه xland شو',
    tagline: 'امپراتوری خودت رو بساز، سرزمین قلمروگشایی کن و با تجهیزات مدرن ازش دفاع کن.',

    featuresTitle: 'تجهیزات میدان نبرد',
    featuresDesc: 'هر چیزی که برای یک عملیات نظامی واقعی در ماینکرفت نیاز داری، اینجا پیاده‌سازی شده.',
    features: [
      { icon: '✈', title: 'جت‌های F-16', desc: 'پرواز، حمله هوایی و درگیری‌های هوا-به-زمین با فیزیک اختصاصی و کنترل روان.' },
      { icon: '▣', title: 'تانک‌های زرهی', desc: 'نبردهای زمینی سنگین با تانک‌های قابل شخصی‌سازی و مکانیک آسیب واقع‌گرایانه.' },
      { icon: '⌁', title: 'اسلحه‌های مدرن', desc: 'آرسنالی از سلاح‌های سبک تا سنگین، صدا و بازخورد اختصاصی برای هر تیراندازی.' },
      { icon: '◈', title: 'سیستم هک', desc: 'نفوذ به سیستم‌های دشمن، غیرفعال‌سازی تجهیزات و دسترسی به اطلاعات محرمانه.' }
    ],

    mapTitle: 'مپ اختصاصی خاورمیانه',
    mapDesc1: 'یک نقشه گسترده با الهام از جغرافیای خاورمیانه، جایی که خودِ پلیرها امپراتوری و تمدن خودشان را از صفر می‌سازند؛ از یک پایگاه کوچک تا یک قدرت منطقه‌ای.',
    mapDesc2: 'سرزمین قلمروگشایی کن، شهر و پایگاه نظامی اختصاصی بساز، با بازیکنان دیگر متحد شو و با تانک، جت و اسلحه‌های مدرن با امپراتوری‌های رقیب بجنگ.',
    mapTags: ['امپراتوری‌سازی', 'تسخیر قلمرو', 'پایگاه نظامی', 'نبردهای زرهی و هوایی'],

    // Phase 3 — count-up stats strip. Values default to 0 since the
    // server is still under construction; edit these anytime from
    // the admin panel's "محتوای متنی سایت" tab.
    stats: [
      { label: 'بازیکن آنلاین', value: 0, suffix: '' },
      { label: 'امپراتوری ثبت‌شده', value: 0, suffix: '' },
      { label: 'جنگ برگزارشده', value: 0, suffix: '' },
      { label: 'آپ‌تایم سرور', value: 0, suffix: '%' }
    ]
  },
  products: [],
  admin: {
    username: 'admin',
    password: '7a1ad5bb2cd09e1a120df6b610e48131481bc0b4a1edd09f0aa78928cd82b1a0'
  }
};

async function xlandSha256Hex(text) {
  if (window.crypto && window.crypto.subtle && window.isSecureContext !== false) {
    try {
      const bytes = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      console.warn('Web Crypto hashing failed, using fallback hash.', e);
    }
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function xlandLooksHashed(str) {
  return typeof str === 'string' && /^[a-f0-9]{16,64}$/i.test(str);
}

const XlandStore = {
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('XlandStore read error', key, e);
      return fallback;
    }
  },
  _write(key, value) {
    // Used for explicit, user-driven mutations (admin panel saves via
    // saveConfig/saveProducts/addProduct/etc.). Writes to the local
    // cache AND pushes to Firebase — this is the only path that should
    // ever modify the shared database.
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (typeof database !== 'undefined') {
        if (key === XLAND_KEYS.CONFIG) database.ref('config').set(value);
        if (key === XLAND_KEYS.PRODUCTS) database.ref('products').set(value);
      }
      return true;
    } catch (e) {
      console.error('XlandStore write error', key, e);
      return false;
    }
  },
  _writeLocal(key, value) {
    // Local-cache-only write, with NO Firebase sync. Used only during
    // init()'s own bootstrap/merge step below, so that simply loading
    // a page (with possibly-empty or stale localStorage) can never
    // overwrite the shared Firebase data with local defaults. Firebase
    // stays untouched until an admin explicitly saves something.
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('XlandStore local write error', key, e);
      return false;
    }
  },

  init() {
    if (localStorage.getItem(XLAND_KEYS.CONFIG) === null) {
      this._writeLocal(XLAND_KEYS.CONFIG, XLAND_DEFAULTS.config);
    } else {
      const current = this._read(XLAND_KEYS.CONFIG, {});
      const merged = {
        ...XLAND_DEFAULTS.config,
        ...current,
        socials: { ...XLAND_DEFAULTS.config.socials, ...(current.socials || {}) }
      };
      this._writeLocal(XLAND_KEYS.CONFIG, merged);
    }
    if (localStorage.getItem(XLAND_KEYS.PRODUCTS) === null) {
      this._writeLocal(XLAND_KEYS.PRODUCTS, XLAND_DEFAULTS.products);
    }
    if (localStorage.getItem(XLAND_KEYS.ADMIN) === null) {
      this._writeLocal(XLAND_KEYS.ADMIN, XLAND_DEFAULTS.admin);
    }

    // لود آنلاین داده‌ها از دیتابیس در صورت موجود بودن. توجه: اگر
    // دیتابیس هنوز خالی باشد (val === null)، عمداً چیزی به فایربیس
    // نمی‌نویسیم — فقط یک ذخیره‌ی واقعی از پنل مدیریت باید دیتابیس را
    // پر کند، نه صرفِ باز شدن صفحه.
    if (typeof database !== 'undefined') {
      database.ref('config').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          localStorage.setItem(XLAND_KEYS.CONFIG, JSON.stringify(val));
          window.dispatchEvent(new CustomEvent('xland:config-updated', { detail: val }));
        }
      });
      database.ref('products').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          localStorage.setItem(XLAND_KEYS.PRODUCTS, JSON.stringify(val));
          window.dispatchEvent(new CustomEvent('xland:products-updated', { detail: val }));
        }
      });
    }
  },

  getConfig() {
    return this._read(XLAND_KEYS.CONFIG, XLAND_DEFAULTS.config);
  },
  saveConfig(partial) {
    const current = this.getConfig();
    const updated = { ...current, ...partial };
    this._write(XLAND_KEYS.CONFIG, updated);
    return updated;
  },
  saveSocials(socials) {
    const current = this.getConfig();
    const updated = { ...current, socials: { ...current.socials, ...socials } };
    this._write(XLAND_KEYS.CONFIG, updated);
    return updated;
  },

  getProducts() {
    return this._read(XLAND_KEYS.PRODUCTS, []);
  },
  saveProducts(list) {
    this._write(XLAND_KEYS.PRODUCTS, list);
  },
  addProduct(product) {
    const list = this.getProducts();
    product.id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    list.push(product);
    this.saveProducts(list);
    return product;
  },
  updateProduct(id, updates) {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.saveProducts(list);
    return list[idx];
  },
  getProduct(id) {
    return this.getProducts().find(p => p.id === id) || null;
  },
  deleteProduct(id) {
    const list = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(list);
  },

  getAdmin() {
    return this._read(XLAND_KEYS.ADMIN, XLAND_DEFAULTS.admin);
  },
  async saveAdmin(partial) {
    const current = this.getAdmin();
    const updates = { ...partial };
    if (updates.password) {
      updates.password = await xlandSha256Hex(updates.password);
    }
    const updated = { ...current, ...updates };
    this._write(XLAND_KEYS.ADMIN, updated);
    return updated;
  },

  isLoggedIn() {
    return sessionStorage.getItem(XLAND_KEYS.SESSION) === 'true';
  },
  async login(username, password) {
    const admin = this.getAdmin();
    if (username !== admin.username) return false;

    if (xlandLooksHashed(admin.password)) {
      const hash = await xlandSha256Hex(password);
      if (hash === admin.password) {
        sessionStorage.setItem(XLAND_KEYS.SESSION, 'true');
        return true;
      }
      return false;
    }

    if (password === admin.password) {
      sessionStorage.setItem(XLAND_KEYS.SESSION, 'true');
      this.saveAdmin({ password }).catch(() => {});
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(XLAND_KEYS.SESSION);
  },

  exportData() {
    return JSON.stringify({
      config: this.getConfig(),
      products: this.getProducts()
    }, null, 2);
  },
  importData(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (parsed.config) this.saveConfig(parsed.config);
    if (parsed.products) this.saveProducts(parsed.products);
    return parsed;
  }
};

XlandStore.init();
