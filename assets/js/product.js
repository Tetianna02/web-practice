'use strict';

(function () {
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
    quantity.value = String(Math.max(1, Math.min(99, Math.trunc(Number(value)) || 1)));
    less.disabled = Number(quantity.value) === 1;
    more.disabled = Number(quantity.value) === 99;
  }
  less.addEventListener('click', function () { updateQuantity(Number(quantity.value) - 1); });
  more.addEventListener('click', function () { updateQuantity(Number(quantity.value) + 1); });
  quantity.addEventListener('change', function () { updateQuantity(quantity.value); });
  updateQuantity(quantity.value);
  document.querySelector('[data-buy-product]').addEventListener('click', function () {
    updateQuantity(quantity.value);
    Shop.add('white', Number(quantity.value));
    window.location.href = '/web-practice/cart.html';
  });
})();
