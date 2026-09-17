/* ============================================================
   XLAND — common.js
   Loaded on every page (after data.js, before the page script).
   Icons are generic pictograms (chat bubble, paper plane, play
   button…) rather than exact brand logos, and are set on any
   element carrying data-<platform>-link + a .social-icon child.
   ============================================================ */

const XLAND_SOCIAL_KEYS = ['discord', 'telegram', 'rubika', 'youtube', 'aparat'];

const XLAND_SOCIAL_LABELS = {
  discord: 'دیسکورد',
  telegram: 'تلگرام',
  rubika: 'روبیکا',
  youtube: 'یوتیوب',
  aparat: 'آپارات'
};

const XLAND_SOCIAL_SUB = {
  discord: 'اطلاعیه‌ها و پشتیبانی',
  telegram: 'اخبار سرور',
  rubika: 'اخبار و کلیپ',
  youtube: 'ویدیوهای گیم‌پلی',
  aparat: 'کلیپ و تیزر'
};

function xlandToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function xlandFormatToman(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('fa-IR') + ' تومان';
}

/* Applies config.socials to every element in the page carrying
   data-<key>-link (nav icons, footer icons, connect-section cards).
   Elements with no URL configured are hidden rather than left as
   dead links. */
function xlandApplySocialLinks(config) {
  const socials = config.socials || {};
  XLAND_SOCIAL_KEYS.forEach(key => {
    const url = socials[key];
    document.querySelectorAll('[data-' + key + '-link]').forEach(el => {
      if (url) {
        el.href = url;
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof XlandStore !== 'undefined') {
    xlandApplySocialLinks(XlandStore.getConfig());
  }
});

// Live update: re-apply social links whenever data.js's Firebase
// listener pushes fresh config (e.g. admin changed a link from
// another device), without needing a full page reload.
window.addEventListener('xland:config-updated', (e) => {
  xlandApplySocialLinks(e.detail || XlandStore.getConfig());
});
