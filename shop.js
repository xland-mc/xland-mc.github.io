/* ============================================================
   XLAND — shop.js
   Renders product cards from XlandStore, or the empty state
   when no products exist yet. Buy button opens the product's
   purchase link (Discord ticket, bot command, payment page…)
   since a static site can't process real payments on its own.
   Relies on xlandToast()/xlandFormatToman() from common.js.
   ============================================================ */

function xlandRenderShop() {
  const products = XlandStore.getProducts();
  const grid = document.getElementById('shop-grid');
  const empty = document.getElementById('shop-empty');

  if (!products || products.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';
  grid.innerHTML = '';

  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card tilt-card';

    const imageStyle = p.image
      ? `style="background-image:url('${p.image.replace(/'/g, "\\'")}')"`
      : '';
    const imagePlaceholder = p.image ? '' : 'بدون تصویر';

    card.innerHTML = `
      <div class="product-image" ${imageStyle}>${imagePlaceholder}</div>
      <div class="product-body">
        <div class="product-name"></div>
        <div class="product-desc"></div>
        <div class="product-price"></div>
        <a class="btn btn-primary buy-btn" style="justify-content:center;">خرید</a>
      </div>
    `;

    card.querySelector('.product-name').textContent = p.name || 'بدون‌نام';
    card.querySelector('.product-desc').textContent = p.description || '';
    card.querySelector('.product-price').textContent = xlandFormatToman(p.price);

    const buyBtn = card.querySelector('.buy-btn');
    if (p.buyLink) {
      buyBtn.href = p.buyLink;
      buyBtn.target = '_blank';
      buyBtn.rel = 'noopener';
    } else {
      buyBtn.href = '#';
      buyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        xlandToast('برای خرید این آیتم با ادمین یا دیسکورد سرور در تماس باش.');
      });
    }

    grid.appendChild(card);
  });

  // Phase 2/3 visual effects (effects.js) — bind 3D tilt + cursor
  // spotlight to the product cards we just created.
  if (typeof xlandBindTilt === 'function') xlandBindTilt(grid);
  if (typeof xlandInitSpotlight === 'function') xlandInitSpotlight(grid);
}

document.addEventListener('DOMContentLoaded', xlandRenderShop);

// Live update: re-render the shop immediately when data.js's Firebase
// listener pushes fresh products (e.g. admin added/edited an item),
// instead of waiting for a full page reload.
window.addEventListener('xland:products-updated', xlandRenderShop);
