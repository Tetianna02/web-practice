'use strict';

window.Shop = (function () {
  const products = {
    white: { id: 'white', name: 'Havic HV G-92 Gamepad', price: 192, image: 'gamepad-main.webp', width: 892, height: 630 },
    gamepad: { id: 'gamepad', name: 'Геймпад HAVIT HV-G92', price: 1199, image: 'product-gamepad-havit.webp' },
    keyboard: { id: 'keyboard', name: 'Дротова клавіатура AK-900', price: 2599, image: 'product-keyboard-ak900.webp' },
    monitor: { id: 'monitor', name: 'Ігровий IPS LCD монітор', price: 7499, image: 'product-monitor-ips.webp' },
    cooler: { id: 'cooler', name: 'Кулер RGB Liquid CPU', price: 3499, image: 'product-cpu-cooler.webp' }
  };
  const key = 'exclusive-layout-cart-v1';
  const seed = [{ id: 'monitor', quantity: 1 }, { id: 'gamepad', quantity: 2 }];
  let memory = seed.map(function (item) { return Object.assign({}, item); });
  function readCart() {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) memory = parsed.filter(function (item) {
          return item && products[item.id] && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99;
        }).map(function (item) { return { id: item.id, quantity: item.quantity }; });
      }
    } catch (error) {
      // The visual prototype also works when browser storage is unavailable.
    }
    return memory.map(function (item) { return Object.assign({}, item); });
  }
  function saveCart(items) {
    memory = items.map(function (item) { return { id: item.id, quantity: item.quantity }; });
    try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch (error) { /* Keep the in-memory demo usable. */ }
    updateBadge();
    window.dispatchEvent(new CustomEvent('shop:cart-change'));
  }
  function add(id, quantity) {
    if (!products[id]) return;
    const items = readCart();
    const item = items.find(function (entry) { return entry.id === id; });
    if (item) item.quantity = Math.min(99, item.quantity + quantity);
    else items.push({ id: id, quantity: Math.max(1, Math.min(99, quantity)) });
    saveCart(items);
  }
  function money(value) { return new Intl.NumberFormat('uk-UA').format(value) + ' ₴'; }
  function total(items) { return items.reduce(function (sum, item) { return sum + products[item.id].price * item.quantity; }, 0); }
  function updateBadge() {
    document.querySelectorAll('[data-cart-badge]').forEach(function (badge) {
      const count = readCart().length;
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }
  document.querySelectorAll('.shop-page .search-form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      closeMobileMenu();
      showToast(comingSoonMessage);
    });
  });
  const toggle = document.querySelector('.shop-profile-toggle');
  const menu = document.querySelector('.shop-account-menu');
  function closeAccountMenu(restoreFocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      const opened = menu.hidden;
      menu.hidden = !opened;
      toggle.setAttribute('aria-expanded', String(opened));
      if (opened) menu.querySelector('a').focus();
    });
    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target) && !toggle.contains(event.target)) closeAccountMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeAccountMenu(true);
    });
    menu.addEventListener('click', function () { closeAccountMenu(false); });
  }
  document.querySelectorAll('[data-add-product]').forEach(function (button) {
    button.addEventListener('click', function () {
      add(button.dataset.addProduct, 1);
      showToast('Товар додано до демонстраційного кошика');
    });
  });
  function setupImageFallbacks() {
    document.querySelectorAll('[data-image-frame]').forEach(function (frame) {
      const image = frame.querySelector('img');
      const fallback = frame.querySelector('.shop-image-fallback');
      if (!image || !fallback) return;
      function failed() { image.hidden = true; fallback.hidden = false; }
      image.addEventListener('error', failed);
      image.addEventListener('load', function () { image.hidden = false; fallback.hidden = true; });
      if (image.complete && !image.naturalWidth) failed();
    });
  }
  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid]').forEach(function (field) { field.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.shop-field-error').forEach(function (error) { error.textContent = ''; });
  }
  function fieldError(field, message) {
    field.setAttribute('aria-invalid', 'true');
    const error = document.getElementById(field.id + '-error');
    if (error) error.textContent = message;
  }
  function validate(form) {
    clearErrors(form);
    form.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select').forEach(function (field) {
      if (field.disabled || field.closest('[hidden]')) return;
      if (field.required && !field.value.trim()) fieldError(field, 'Заповніть це поле.');
      else if (field.value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(field.value)) fieldError(field, 'Введіть коректну електронну пошту.');
      else if (field.value && field.type === 'tel' && !/^[+]?[\d\s()-]+$/u.test(field.value)) fieldError(field, 'Введіть коректний номер телефону.');
      else if (field.value && field.minLength > 0 && field.value.length < field.minLength) fieldError(field, 'Введіть щонайменше ' + field.minLength + ' символів.');
      else if (field.value && field.validity.patternMismatch) fieldError(field, 'Перевірте формат введених даних.');
    });
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
    return !first;
  }
  setupImageFallbacks();
  updateBadge();
  return { products: products, readCart: readCart, saveCart: saveCart, add: add, money: money, total: total,
    updateBadge: updateBadge, setupImageFallbacks: setupImageFallbacks, clearErrors: clearErrors, fieldError: fieldError, validate: validate };
})();
