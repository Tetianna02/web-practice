'use strict';

(function () {
  let product = null;
  const image = document.querySelector('[data-main-product-image]');
  document.querySelectorAll('[data-gallery-image]').forEach(function (button) {
    button.addEventListener('click', function () {
      image.src = button.dataset.galleryImage;
      image.alt = button.querySelector('img').alt;
      document.querySelectorAll('[data-gallery-image]').forEach(function (item) {
        item.setAttribute('aria-pressed', String(item === button));
      });
    });
  });
  ['.product-colors', '.product-sizes'].forEach(function (selector) {
    const group = document.querySelector(selector);
    group.addEventListener('click', function (event) {
      const selected = event.target.closest('button');
      if (!selected) return;
      group.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button === selected));
      });
    });
  });
  const quantity = document.getElementById('detail-quantity');
  const less = document.querySelector('[data-quantity-less]');
  const more = document.querySelector('[data-quantity-more]');
  function updateQuantity(value) {
    const max = product ? Math.min(99, product.stock) : 99;
    quantity.max = String(Math.max(1, max));
    quantity.value = String(Math.max(1, Math.min(Math.max(1, max), Math.trunc(Number(value)) || 1)));
    less.disabled = Number(quantity.value) === 1;
    more.disabled = Number(quantity.value) >= max;
  }
  less.addEventListener('click', function () { updateQuantity(Number(quantity.value) - 1); });
  more.addEventListener('click', function () { updateQuantity(Number(quantity.value) + 1); });
  quantity.addEventListener('change', function () { updateQuantity(quantity.value); });
  updateQuantity(quantity.value);
  const buy = document.querySelector('[data-buy-product]');
  buy.disabled = true;
  buy.addEventListener('click', async function () {
    updateQuantity(quantity.value);
    buy.disabled = true;
    try {
      if (product && await Shop.add(product.id, Number(quantity.value))) location.assign(Store.page('cart.html'));
    } catch (error) { showToast(error.message); }
    finally { buy.disabled = !product || product.stock === 0; }
  });
  window.ProductReady = (async function () {
    try {
      await window.StoreReady;
      const id = new URLSearchParams(location.search).get('id') || 'white';
      const result = await Store.request('/products/' + encodeURIComponent(id));
      product = result.data;
      await Shop.ready;
      document.getElementById('product-title').textContent = product.name;
      document.title = (product.name.slice(0, 48) + ' — Exclusive').slice(0, 65);
      document.querySelector('.shop-breadcrumbs li:last-child').textContent = product.name;
      const category = document.querySelector('.shop-breadcrumbs li:nth-child(3) a');
      category.textContent = product.categoryName;
      category.href = Store.page('', { category: product.category }) + '#explore-products';
      document.querySelector('.product-detail-price').textContent = product.price.toLocaleString('uk-UA', { minimumFractionDigits: 2 }) + ' ₴';
      document.querySelector('.product-description').textContent = product.description || product.name;
      document.querySelector('.review-count').textContent = product.reviews + ' відгуків';
      const stars = document.querySelector('.product-rating-row .detail-stars');
      const star = stars.querySelector('svg').cloneNode(true);
      stars.setAttribute('aria-label', 'Оцінка ' + product.rating + ' з 5');
      stars.replaceChildren();
      for (let index = 0; index < 5; index += 1) {
        const icon = star.cloneNode(true);
        const type = product.rating >= index + 1 ? 'star' : product.rating >= index + 0.5 ? 'star-half' : 'star-empty';
        icon.querySelector('use').setAttribute('href', 'assets/images/icons/sprite.svg#icon-' + type);
        if (type === 'star-empty') { const empty = document.createElement('span'); empty.className = 'empty-star'; empty.append(icon); stars.append(empty); }
        else stars.append(icon);
      }
      document.querySelector('.stock-label').textContent = product.stock ? 'У наявності' : 'Немає в наявності';
      const mainSource = 'assets/images/optimized/' + product.image;
      image.src = mainSource; image.alt = product.alt;
      const gallery = product.gallery.length ? product.gallery : [product.image];
      document.querySelectorAll('[data-gallery-image]').forEach(function (button, index) {
        button.hidden = index >= gallery.length;
        if (button.hidden) return;
        button.dataset.galleryImage = 'assets/images/optimized/' + gallery[index];
        button.querySelector('img').src = button.dataset.galleryImage;
        button.querySelector('img').alt = product.name + ', фото ' + (index + 1);
      });
      document.querySelectorAll('.product-sizes button').forEach(function (button, index) {
        if (product.sizes[index]) button.textContent = product.sizes[index];
        button.hidden = index >= product.sizes.length;
      });
      document.querySelector('.product-sizes').closest('.product-option-row').hidden = !product.sizes.length;
      document.querySelector('.product-colors').closest('.product-option-row').hidden = !product.colors.length;
      document.querySelectorAll('.related-card').forEach(function (card) {
        const button = card.querySelector('[data-add-product]');
        const related = Shop.products[Shop.canonical(button.dataset.addProduct)];
        if (!related) { card.hidden = true; return; }
        button.dataset.addProduct = related.id;
        button.disabled = !related.stock;
        card.querySelector('h3').textContent = related.name;
        card.querySelector('strong').textContent = Shop.money(related.price);
        const old = card.querySelector('s'); old.hidden = !related.oldPrice;
        if (related.oldPrice) old.textContent = Shop.money(related.oldPrice);
        card.querySelector('.product-image').src = 'assets/images/optimized/' + related.image;
        card.querySelector('.product-image').alt = related.alt;
        const preview = card.querySelector('.related-tools button:last-child');
        preview.removeAttribute('data-coming-soon');
        preview.addEventListener('click', function () { location.assign(Store.productUrl(related.id)); });
      });
      updateQuantity(quantity.value);
      buy.disabled = !product.stock;
      return product;
    } catch (error) {
      if (error.status === 404 || error.status === 400) location.replace(Store.page('404.html'));
      else {
        document.querySelector('.stock-label').textContent = 'Товар не завантажено';
        showToast(error.message);
      }
      return null;
    }
  })();
})();
