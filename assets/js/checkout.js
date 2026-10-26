'use strict';

(function () {
  const items = Shop.readCart();
  const list = document.querySelector('[data-checkout-items]');
  const form = document.querySelector('[data-checkout-form]');
  const status = document.querySelector('[data-checkout-status]');
  items.slice().reverse().forEach(function (item) {
    const product = Shop.products[item.id];
    const row = document.createElement('div');
    row.className = 'checkout-item';
    const frame = document.createElement('div');
    frame.className = 'checkout-item-image';
    frame.setAttribute('data-image-frame', '');
    const img = document.createElement('img');
    img.src = 'assets/images/optimized/' + product.image;
    img.alt = product.name;
    const fallback = document.createElement('span');
    fallback.className = 'shop-image-fallback'; fallback.hidden = true; fallback.textContent = 'Немає фото';
    frame.append(img, fallback);
    const title = document.createElement('span');
    title.className = 'checkout-item-name'; title.textContent = product.name;
    const quantity = document.createElement('span');
    quantity.className = 'visually-hidden'; quantity.textContent = ', кількість: ' + item.quantity;
    title.append(quantity);
    const price = document.createElement('span');
    price.className = 'checkout-item-price'; price.textContent = Shop.money(product.price * item.quantity);
    row.append(frame, title, price); list.append(row);
  });
  document.querySelectorAll('[data-checkout-total]').forEach(function (element) {
    element.textContent = Shop.money(Shop.total(items));
  });
  if (!items.length) {
    document.querySelector('.checkout-empty').hidden = false;
    document.querySelector('.checkout-submit').disabled = true;
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    status.textContent = '';
    if (!Shop.validate(form)) return;
    status.textContent = 'Форму перевірено. Це демонстрація: замовлення не надіслано, контактні дані не збережено.';
    showToast('Дані замовлення перевірено');
  });
  document.querySelector('[data-checkout-coupon]').addEventListener('submit', function (event) {
    event.preventDefault();
    document.querySelector('[data-checkout-coupon-status]').textContent = event.currentTarget.elements.coupon.value.trim()
      ? 'Буде доступно на наступному етапі' : 'Введіть промокод.';
  });
  Shop.setupImageFallbacks();
})();
