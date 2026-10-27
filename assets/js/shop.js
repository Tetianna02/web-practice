'use strict';

window.Shop = (function () {
  const products = Object.create(null);
  const aliases = { gamepad: 'gamepad-havit', keyboard: 'keyboard-ak900', monitor: 'monitor-ips', cooler: 'cpu-cooler' };
  const key = 'exclusive-cart-v2';
  let memory = [];
  let available = false;
  function canonical(id) { return Object.hasOwn(aliases, id) ? aliases[id] : id; }
  function readCart() {
    try {
      const saved = sessionStorage.getItem(key);
      const legacy = saved === null ? sessionStorage.getItem('exclusive-layout-cart-v1') : null;
      if (saved !== null || legacy !== null) {
        const parsed = JSON.parse(saved === null ? legacy : saved);
        if (Array.isArray(parsed)) {
          const unique = new Map();
          parsed.slice(0, 100).forEach(function (item) {
            if (!item || typeof item.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) return;
            if (Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99) {
              const id = canonical(item.id);
              unique.set(id, { id: id, quantity: item.quantity });
            }
          });
          memory = Array.from(unique.values());
        }
      }
    } catch (_) { /* Use memory when storage is unavailable. */ }
    return memory.map(function (item) { return Object.assign({}, item); });
  }
  function saveCart(items) {
    memory = items.map(function (item) { return { id: canonical(item.id), quantity: item.quantity }; });
    try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch (_) { /* Keep this page usable. */ }
    updateBadge();
    window.dispatchEvent(new CustomEvent('shop:cart-change'));
  }
  async function add(id, quantity) {
    await ready;
    id = canonical(id);
    const product = products[id];
    if (!product || !product.stock) { showToast('Цей товар зараз недоступний.'); return false; }
    const items = readCart();
    const item = items.find(function (entry) { return entry.id === id; });
    const max = Math.min(99, product.stock);
    const requested = Math.max(1, Math.trunc(Number(quantity)) || 1);
    if (item) item.quantity = Math.min(max, item.quantity + requested);
    else items.push({ id: id, quantity: Math.min(max, requested) });
    saveCart(items);
    return true;
  }
  function money(value) { return new Intl.NumberFormat('uk-UA').format(value) + ' ₴'; }
  function total(items) { return items.reduce(function (sum, item) { return sum + Math.round(products[item.id].price * 100) * item.quantity; }, 0) / 100; }
  function updateBadge() {
    document.querySelectorAll('[data-cart-badge]').forEach(function (badge) {
      const count = readCart().reduce(function (sum, item) { return sum + item.quantity; }, 0);
      badge.textContent = String(count); badge.hidden = count === 0;
    });
  }
  const ready = window.StoreReady.then(function (api) { return api.catalog(); }).then(function (items) {
    items.forEach(function (product) { products[product.id] = product; });
    available = true;
    const saved = readCart();
    const valid = saved.filter(function (item) { return products[item.id] && products[item.id].stock > 0; })
      .map(function (item) { return { id: item.id, quantity: Math.min(item.quantity, products[item.id].stock, 99) }; });
    if (JSON.stringify(valid) !== JSON.stringify(saved)) {
      saveCart(valid); showToast('Кошик оновлено відповідно до наявності товарів.');
    }
    return products;
  });
  ready.catch(function () {});
  document.querySelectorAll('.shop-page .search-form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      closeMobileMenu();
      window.StoreReady.then(function (api) { api.search(form.querySelector('input').value); }).catch(function (error) { showToast(error.message); });
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
    button.addEventListener('click', async function () {
      button.disabled = true;
      try { if (await add(button.dataset.addProduct, 1)) showToast('Товар додано до кошика'); }
      catch (error) { showToast(error.message); }
      finally { button.disabled = false; }
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
  return { ready: ready, canonical: canonical, isAvailable: function () { return available; }, products: products, readCart: readCart, saveCart: saveCart, add: add, money: money, total: total,
    updateBadge: updateBadge, setupImageFallbacks: setupImageFallbacks, clearErrors: clearErrors, fieldError: fieldError, validate: validate };
})();
