'use strict';

(function () {
  const list = document.querySelector('[data-checkout-items]');
  const form = document.querySelector('[data-checkout-form]');
  const status = document.querySelector('[data-checkout-status]');
  const submit = document.querySelector('.checkout-submit');
  let pending = false;
  let pendingRequest = null;
  form.elements.remember.title = 'Зберегти ім’я та адресу у профілі для наступного оформлення.';
  function render() {
    const items = Shop.readCart();
    list.replaceChildren();
    items.slice().reverse().forEach(function (item) {
      const product = Shop.products[item.id];
      const row = document.createElement('div'); row.className = 'checkout-item';
      const frame = document.createElement('div'); frame.className = 'checkout-item-image'; frame.setAttribute('data-image-frame', '');
      const img = document.createElement('img'); img.src = 'assets/images/optimized/' + product.image; img.alt = product.name;
      const fallback = document.createElement('span'); fallback.className = 'shop-image-fallback'; fallback.hidden = true; fallback.textContent = 'Немає фото';
      frame.append(img, fallback);
      const title = document.createElement('span'); title.className = 'checkout-item-name'; title.textContent = product.name;
      const quantity = document.createElement('span'); quantity.className = 'visually-hidden'; quantity.textContent = ', кількість: ' + item.quantity;
      title.append(quantity);
      const price = document.createElement('span'); price.className = 'checkout-item-price'; price.textContent = Shop.money(product.price * item.quantity);
      row.append(frame, title, price); list.append(row);
    });
    document.querySelectorAll('[data-checkout-total]').forEach(function (element) { element.textContent = Shop.money(Shop.total(items)); });
    document.querySelector('.checkout-empty').hidden = items.length !== 0;
    submit.disabled = !items.length || pending;
    Shop.setupImageFallbacks();
  }
  function value(name) { return form.elements.namedItem(name).value.trim(); }
  async function requestId(payload) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const fingerprint = Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    let previous = pendingRequest;
    try { previous = JSON.parse(sessionStorage.getItem('exclusive-order-request')) || previous; } catch (_) { /* Memory fallback below. */ }
    if (previous && previous.fingerprint === fingerprint && typeof previous.id === 'string') return previous.id;
    const id = Store.uuid();
    pendingRequest = { id: id, fingerprint: fingerprint };
    try { sessionStorage.setItem('exclusive-order-request', JSON.stringify({ id: id, fingerprint: fingerprint })); } catch (_) { /* No contact details are stored. */ }
    return id;
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !Shop.isAvailable()) return;
    status.textContent = '';
    if (!Shop.validate(form)) return;
    const phone = value('phone');
    if (phone.replace(/\D/g, '').length < 7) { Shop.fieldError(form.elements.phone, 'Введіть щонайменше 7 цифр телефону.'); form.elements.phone.focus(); return; }
    const items = Shop.readCart();
    if (!items.length) { render(); return; }
    pending = true; submit.disabled = true; form.setAttribute('aria-busy', 'true');
    try {
      await Store.requireUser();
      const customer = { name: value('first-name'), email: value('email'), phone: phone, city: value('city'), street: value('street'), apartment: value('apartment'), company: value('company') };
      const payload = { items: items.map(function (item) { return { productId: item.id, quantity: item.quantity }; }), customer: customer, paymentMethod: form.elements.payment.value };
      payload.requestId = await requestId(payload);
      status.textContent = 'Зберігаємо замовлення…';
      const result = await Store.request('/orders', { method: 'POST', auth: true, body: payload });
      Shop.saveCart([]);
      pendingRequest = null;
      try { sessionStorage.removeItem('exclusive-order-request'); } catch (_) { /* No persisted request to clear. */ }
      if (form.elements.remember.checked) {
        try {
          const saved = await Store.request('/auth/me', { method: 'PATCH', auth: true, body: { name: customer.name, address: customer.street } });
          Store.updateUser(saved.data);
        } catch (_) { showToast('Замовлення збережено, але дані профілю не оновлено.'); }
      }
      render();
      document.querySelector('.checkout-empty').hidden = true;
      status.textContent = 'Замовлення №' + result.data.id.slice(0, 8) + ' збережено. Разом: ' + Shop.money(result.data.total) + '. Онлайн-оплата не проводилася. ';
      const link = document.createElement('a'); link.href = Store.page('account.html') + '#orders'; link.textContent = 'Мої замовлення'; status.append(link);
      showToast('Замовлення успішно збережено');
    } catch (error) {
      status.textContent = error.message + (error.status === 0 ? ' Перед повторенням перевірте розділ «Мої замовлення».' : '');
      Store.fieldErrors(form, error, { name: 'first-name' });
      if (error.status === 401) location.assign(Store.loginUrl());
    } finally {
      pending = false; form.removeAttribute('aria-busy'); submit.disabled = !Shop.readCart().length;
    }
  });
  document.querySelector('[data-checkout-coupon]').addEventListener('submit', function (event) {
    event.preventDefault();
    document.querySelector('[data-checkout-coupon-status]').textContent = event.currentTarget.elements.coupon.value.trim() ? comingSoonMessage : 'Введіть промокод.';
  });
  window.CheckoutReady = (async function () {
    try {
      await Shop.ready;
      const user = await Store.requireUser();
      form.elements['first-name'].value = user.name;
      form.elements.email.value = user.email;
      form.elements.street.value = user.address || '';
      form.elements['first-name'].maxLength = 160;
      form.elements.city.minLength = 2; form.elements.city.maxLength = 120;
      form.elements.street.minLength = 3; form.elements.street.maxLength = 300;
      render();
    } catch (error) { status.textContent = error.message; submit.disabled = true; }
  })();
})();
