'use strict';

(function () {
  const form = document.querySelector('[data-profile-form]');
  const status = document.querySelector('[data-profile-status]');
  const current = document.getElementById('account-current-password');
  const password = document.getElementById('account-new-password');
  const confirmation = document.getElementById('account-confirm-password');
  const profilePanel = document.querySelector('[data-account-panel="profile"]');
  const ordersPanel = document.querySelector('[data-account-panel="orders"]');
  const save = form.querySelector('[type="submit"]');
  const fields = { name: 'first-name', lastName: 'last-name', email: 'email', address: 'address', currentPassword: 'current-password', newPassword: 'new-password' };
  let user = null;
  let adminPanel = null;
  let ordersGeneration = 0;
  let saving = false;
  form.elements['last-name'].required = false;
  form.querySelectorAll('input').forEach(function (input) { input.value = ''; });
  document.querySelector('.account-welcome span').textContent = '…';
  function populate(next) {
    user = next;
    ['name', 'lastName', 'email', 'address'].forEach(function (key) {
      const input = form.elements.namedItem(fields[key]); input.value = next[key] || ''; input.defaultValue = input.value;
    });
    current.value = ''; password.value = ''; confirmation.value = '';
    const welcome = document.querySelector('.account-welcome span');
    const letters = Array.from(next.name);
    welcome.replaceChildren(); welcome.title = next.name;
    for (let index = 0; index < letters.length; index += 20) {
      if (index) welcome.append(document.createElement('wbr'));
      welcome.append(document.createTextNode(letters.slice(index, index + 20).join('')));
    }
  }
  async function loadOrders() {
    const generation = ++ordersGeneration;
    const title = ordersPanel.querySelector('h2');
    const message = document.createElement('p'); message.textContent = 'Завантажуємо замовлення…';
    ordersPanel.replaceChildren(title, message);
    let pageNumber = 1;
    const loadMore = document.createElement('button'); loadMore.type = 'button'; loadMore.className = 'shop-button-outline'; loadMore.textContent = 'Показати ще';
    const names = { pending: 'Нове', processing: 'В обробці', shipped: 'Відправлено', completed: 'Виконано', cancelled: 'Скасовано' };
    async function nextPage() {
      loadMore.disabled = true;
      try {
        const result = await Store.request('/orders?limit=10&page=' + pageNumber, { auth: true });
        if (generation !== ordersGeneration) return;
        message.textContent = !result.pagination.total ? 'У вас ще немає замовлень.' : '';
        result.data.forEach(function (order) {
          const article = document.createElement('article');
          const heading = document.createElement('h3'); heading.textContent = 'Замовлення №' + order.id.slice(0, 8);
          const summary = document.createElement('p'); summary.textContent = new Date(order.createdAt).toLocaleString('uk-UA') + ' · ' + names[order.status] + ' · ' + Shop.money(order.total);
          const detail = document.createElement('details');
          const label = document.createElement('summary'); label.textContent = 'Товари та доставка'; detail.append(label);
          let loaded = false;
          detail.addEventListener('toggle', async function () {
            if (!detail.open || loaded) return;
            loaded = true;
            const body = document.createElement('p'); body.className = 'shop-status'; body.textContent = 'Завантажуємо…'; detail.append(body);
            try {
              const response = await Store.request('/orders/' + order.id, { auth: true });
              body.textContent = response.data.items.map(function (item) { return item.name + ' × ' + item.quantity + ' — ' + Shop.money(item.total); }).join('; ')
                + '. Доставка: ' + response.data.customer.city + ', ' + response.data.customer.street + '. Оплата: ' + (order.paymentMethod === 'cash' ? 'при отриманні' : 'карткою — ще не оплачено') + '.';
            } catch (error) { body.textContent = error.message; loaded = false; }
          });
          article.append(heading, summary, detail); ordersPanel.insertBefore(article, loadMore.parentNode ? loadMore : null);
        });
        pageNumber += 1;
        loadMore.hidden = pageNumber > result.pagination.totalPages;
        if (!loadMore.parentNode) ordersPanel.append(loadMore);
      } catch (error) { message.textContent = error.message; }
      finally { loadMore.disabled = false; }
    }
    loadMore.addEventListener('click', nextPage);
    await nextPage();
  }
  async function switchPanel(name, focus) {
    if (!user) return;
    profilePanel.hidden = name !== 'profile';
    ordersPanel.hidden = name !== 'orders';
    if (adminPanel) adminPanel.hidden = name !== 'admin';
    document.querySelectorAll('[data-show-account]').forEach(function (button) { button.setAttribute('aria-current', button.dataset.showAccount === name ? 'page' : 'false'); });
    if (name === 'orders') await loadOrders();
    if (name === 'admin' && adminPanel) {
      try { if (!window.renderStoreAdmin) await Store.loadScript('admin.js'); await window.renderStoreAdmin(adminPanel); }
      catch (error) { adminPanel.textContent = error.message; }
    }
    const panel = name === 'orders' ? ordersPanel : name === 'admin' ? adminPanel : profilePanel;
    if (focus && panel) panel.querySelector('h2')?.focus();
  }
  function applyHash() {
    const name = location.hash === '#orders' ? 'orders' : location.hash === '#admin' && user?.role === 'ADMIN' ? 'admin' : 'profile';
    switchPanel(name, false);
  }
  document.querySelectorAll('[data-show-account]').forEach(function (button) {
    button.addEventListener('click', function () { location.hash = button.dataset.showAccount === 'profile' ? 'profile' : 'orders'; });
  });
  window.addEventListener('hashchange', applyHash);
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!user || saving) return;
    status.textContent = '';
    if (!Shop.validate(form)) return;
    const changingPassword = Boolean(password.value || confirmation.value);
    if (changingPassword) {
      [current, password, confirmation].forEach(function (input) { if (!input.value) Shop.fieldError(input, 'Заповніть усі поля зміни пароля.'); });
      if (password.value && (password.value.length < 8 || new TextEncoder().encode(password.value).length > 72)) Shop.fieldError(password, 'Пароль: від 8 символів, максимум 72 байти UTF-8.');
      if (confirmation.value !== password.value) Shop.fieldError(confirmation, 'Паролі не збігаються.');
    }
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) { first.focus(); return; }
    const payload = {};
    ['name','lastName','email','address'].forEach(function (key) { payload[key] = form.elements.namedItem(fields[key]).value.trim(); });
    if (current.value) payload.currentPassword = current.value;
    if (changingPassword) payload.newPassword = password.value;
    saving = true; save.disabled = true; form.setAttribute('aria-busy', 'true');
    try {
      const result = await Store.request('/auth/me', { method: 'PATCH', auth: true, body: payload });
      populate(result.data);
      if (result.session) Store.updateSession(result.session);
      else Store.updateUser(result.data);
      status.textContent = 'Зміни профілю збережено.'; showToast('Профіль оновлено');
    } catch (error) { status.textContent = error.message; Store.fieldErrors(form, error, fields); }
    finally { saving = false; save.disabled = false; form.removeAttribute('aria-busy'); }
  });
  form.addEventListener('reset', function () { Shop.clearErrors(form); status.textContent = ''; });
  window.AccountReady = (async function () {
    try {
      await window.StoreReady;
      populate(await Store.requireUser());
      save.disabled = false;
      if (user.role === 'ADMIN') {
        adminPanel = document.createElement('section'); adminPanel.className = 'account-panel-new'; adminPanel.hidden = true;
        adminPanel.setAttribute('aria-label', 'Адміністрування магазину'); profilePanel.parentNode.append(adminPanel);
        const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Адміністрування'; button.dataset.showAccount = 'admin';
        button.addEventListener('click', function () { location.hash = 'admin'; }); item.append(button); document.querySelector('.account-nav-group ul').append(item);
      }
      applyHash();
      return user;
    } catch (error) { status.textContent = error.message; return null; }
  })();
})();
