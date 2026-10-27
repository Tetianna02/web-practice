'use strict';

(function () {
  const list = document.querySelector('[data-cart-items]');
  const table = document.querySelector('.cart-table');
  const empty = document.querySelector('.cart-empty');
  const checkout = document.querySelector('.cart-checkout');
  const update = document.querySelector('[data-update-cart]');
  function render() {
    if (!Shop.isAvailable()) return;
    const items = Shop.readCart();
    list.replaceChildren();
    table.hidden = items.length === 0;
    empty.hidden = items.length !== 0;
    checkout.setAttribute('aria-disabled', String(items.length === 0));
    checkout.tabIndex = items.length ? 0 : -1;
    update.disabled = items.length === 0;
    items.forEach(function (item) {
      const product = Shop.products[item.id];
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.setAttribute('role', 'row');
      row.dataset.cartId = item.id;
      const productCell = document.createElement('div');
      productCell.className = 'cart-product';
      productCell.setAttribute('role', 'cell');
      const frame = document.createElement('div');
      frame.className = 'cart-product-image';
      frame.setAttribute('data-image-frame', '');
      const img = document.createElement('img');
      img.src = 'assets/images/optimized/' + product.image;
      img.alt = product.name;
      const fallback = document.createElement('span');
      fallback.className = 'shop-image-fallback';
      fallback.textContent = 'Немає фото';
      fallback.hidden = true;
      const remove = document.createElement('button');
      remove.className = 'cart-remove';
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Видалити ' + product.name);
      remove.innerHTML = '<img src="assets/images/icons/icon-remove.svg" width="24" height="24" alt="">';
      remove.addEventListener('click', function () {
        Shop.saveCart(Shop.readCart().filter(function (entry) { return entry.id !== item.id; }));
        render();
        showToast('Товар видалено з кошика');
      });
      frame.append(img, fallback, remove);
      const title = document.createElement('a');
      title.href = Store.productUrl(item.id);
      title.textContent = product.name;
      productCell.append(frame, title);
      const price = document.createElement('div');
      price.className = 'cart-cell cart-price';
      price.setAttribute('role', 'cell');
      price.dataset.label = 'Ціна';
      price.textContent = Shop.money(product.price);
      const quantity = document.createElement('div');
      quantity.className = 'cart-cell';
      quantity.setAttribute('role', 'cell');
      quantity.dataset.label = 'Кількість';
      const field = document.createElement('div');
      field.className = 'cart-quantity';
      const input = document.createElement('input');
      input.type = 'number'; input.min = '1'; input.max = String(Math.min(99, product.stock));
      input.name = 'quantity-' + item.id; input.id = 'quantity-' + item.id;
      input.value = String(item.quantity).padStart(2, '0');
      input.setAttribute('aria-label', 'Кількість: ' + product.name);
      function change(value) {
        const quantity = Math.max(1, Math.min(99, product.stock, Math.trunc(Number(value)) || 1));
        Shop.saveCart(Shop.readCart().map(function (entry) { return entry.id === item.id ? { id: item.id, quantity: quantity } : entry; }));
        input.value = String(quantity).padStart(2, '0');
        more.disabled = quantity >= Math.min(99, product.stock);
        less.disabled = quantity === 1;
        subtotal.textContent = Shop.money(product.price * quantity);
        updateTotal();
      }
      const more = document.createElement('button');
      more.type = 'button'; more.setAttribute('aria-label', 'Збільшити кількість: ' + product.name);
      more.innerHTML = '<img src="assets/images/icons/icon-quantity-up.svg" width="16" height="16" alt="">';
      more.disabled = item.quantity >= Math.min(99, product.stock);
      const less = document.createElement('button');
      less.type = 'button'; less.setAttribute('aria-label', 'Зменшити кількість: ' + product.name);
      less.innerHTML = '<img src="assets/images/icons/icon-quantity-down.svg" width="16" height="16" alt="">';
      less.disabled = item.quantity === 1;
      more.addEventListener('click', function () { change(Number(input.value) + 1); });
      less.addEventListener('click', function () { change(Number(input.value) - 1); });
      input.addEventListener('change', function () { change(input.value); });
      field.append(input, more, less); quantity.append(field);
      const subtotal = document.createElement('div');
      subtotal.className = 'cart-cell cart-subtotal';
      subtotal.setAttribute('role', 'cell');
      subtotal.dataset.label = 'Сума';
      subtotal.textContent = Shop.money(product.price * item.quantity);
      row.append(productCell, price, quantity, subtotal);
      list.append(row);
    });
    updateTotal();
    Shop.setupImageFallbacks();
  }
  function updateTotal() {
    const total = Shop.money(Shop.total(Shop.readCart()));
    document.querySelectorAll('[data-cart-total]').forEach(function (element) { element.textContent = total; });
  }
  document.querySelector('[data-coupon-form]').addEventListener('submit', function (event) {
    event.preventDefault();
    const code = event.currentTarget.elements.coupon.value.trim();
    document.querySelector('[data-coupon-status]').textContent = code ? comingSoonMessage : 'Введіть промокод.';
  });
  update.addEventListener('click', function () { render(); showToast('Кошик оновлено'); });
  checkout.addEventListener('click', function (event) {
    if (!Shop.isAvailable() || !Shop.readCart().length) { event.preventDefault(); showToast('Спочатку додайте товар у кошик'); }
  });
  checkout.setAttribute('aria-disabled', 'true');
  update.disabled = true;
  list.setAttribute('aria-busy', 'true');
  Shop.ready.then(render).catch(function (error) {
    document.querySelector('[data-coupon-status]').textContent = error.message;
    checkout.setAttribute('aria-disabled', 'true');
  }).finally(function () { list.removeAttribute('aria-busy'); });
})();
