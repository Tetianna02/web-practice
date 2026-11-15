'use strict';

window.renderStoreAdmin = async function (panel) {
  const user = await Store.requireUser();
  if (user.role !== 'ADMIN') { panel.textContent = 'Доступ лише для адміністратора.'; return; }
  const title = document.createElement('h2'); title.className = 'account-panel-title'; title.tabIndex = -1; title.textContent = 'Керування магазином';
  const tabs = document.createElement('div'); tabs.className = 'account-form-actions';
  const body = document.createElement('div');
  const status = document.createElement('p'); status.className = 'shop-status'; status.setAttribute('role', 'status');
  panel.replaceChildren(title, tabs, status, body);
  let generation = 0;
  function button(label, action, primary) {
    const item = document.createElement('button'); item.type = 'button'; item.className = primary ? 'primary-button account-save' : 'shop-button-outline'; item.textContent = label;
    item.addEventListener('click', async function () {
      if (item.disabled) return;
      item.disabled = true;
      try { await action(item); } catch (error) { status.textContent = error.message; }
      finally { if (item.isConnected) item.disabled = false; }
    });
    return item;
  }
  function input(form, grid, name, label, value, type, required) {
    const wrapper = document.createElement('div'); wrapper.className = 'shop-field';
    const caption = document.createElement('label'); const field = document.createElement('input');
    field.id = 'admin-' + name; field.name = name; field.type = type || 'text'; field.value = value ?? ''; field.required = Boolean(required);
    field.maxLength = name === 'description' ? 5000 : name === 'name' ? 200 : 300;
    field.setAttribute('aria-describedby', field.id + '-error'); caption.htmlFor = field.id; caption.textContent = label;
    const error = document.createElement('span'); error.id = field.id + '-error'; error.className = 'shop-field-error';
    wrapper.append(caption, field, error); grid.append(wrapper); return field;
  }
  function choices(field, values) {
    const list = document.createElement('datalist'); list.id = field.id + '-choices'; field.setAttribute('list', list.id);
    values.forEach(function (value) { const option = document.createElement('option'); option.value = value.id || value; option.label = value.name || value; list.append(option); });
    field.parentNode.append(list);
  }
  function deleteButton(kind, item, reload) {
    let confirmed = false;
    return button('Видалити', async function (control) {
      if (!confirmed) {
        confirmed = true; control.textContent = 'Підтвердити видалення';
        setTimeout(function () { confirmed = false; control.textContent = 'Видалити'; }, 8000);
        return;
      }
      await Store.request('/admin/' + kind + '/' + encodeURIComponent(item.id), { method: 'DELETE', auth: true });
      status.textContent = 'Запис видалено.'; await reload();
    });
  }
  async function editor(kind, item, reload, host, categories) {
    const form = document.createElement('form'); form.className = 'account-profile-form'; form.noValidate = true;
    const heading = document.createElement('h3'); heading.textContent = item ? 'Редагування' : 'Новий запис';
    const grid = document.createElement('div'); grid.className = 'account-profile-grid'; form.append(heading, grid);
    const id = input(form, grid, 'id', 'Код (латиниця, цифри, дефіси)', item?.id || (kind === 'products' ? 'product-' : 'category-') + Store.uuid().slice(0, 8), 'text', true);
    id.maxLength = 80; id.pattern = '[a-z0-9]+(-[a-z0-9]+)*'; id.disabled = Boolean(item);
    input(form, grid, 'name', 'Назва', item?.name || '', 'text', true).minLength = 2;
    input(form, grid, 'description', 'Опис', item?.description || '');
    if (kind === 'products') {
      choices(input(form, grid, 'category', 'Категорія — код зі списку', item?.category || categories[0]?.id, 'text', true), categories);
      const price = input(form, grid, 'price', 'Ціна, грн', item?.price ?? '', 'number', true); price.min = '0.01'; price.max = '1000000'; price.step = '0.01';
      const old = input(form, grid, 'oldPrice', 'Стара ціна, грн (необов’язково)', item?.oldPrice ?? '', 'number'); old.min = '0.01'; old.step = '0.01'; old.max = '1000000';
      const stock = input(form, grid, 'stock', 'Залишок, шт.', item?.stock ?? 0, 'number', true); stock.min = '0'; stock.max = '1000000'; stock.step = '1';
      const image = input(form, grid, 'image', 'Назва зображення з assets/images/optimized', item?.image || '', 'text', true);
      const catalog = await Store.catalog(); choices(image, Array.from(new Set(catalog.map(function (entry) { return entry.image; }))));
      input(form, grid, 'alt', 'Опис зображення', item?.alt || '', 'text', true);
      choices(input(form, grid, 'section', 'Блок: flash — розпродаж; best — популярні; catalog — каталог; details — окремий товар', item?.section || 'catalog', 'text', true), ['flash', 'best', 'catalog', 'details']);
      const active = document.createElement('label'); active.className = 'checkout-remember';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'isActive'; checkbox.checked = item?.isActive ?? true;
      active.append(checkbox, document.createTextNode('Показувати товар у магазині')); form.append(active);
    } else {
      choices(input(form, grid, 'icon', 'Іконка з наявного спрайта', item?.icon || 'gaming'), ['phone','computer','smartwatch','camera','headphones','gaming']);
    }
    const order = input(form, grid, 'sortOrder', 'Порядок відображення', item?.sortOrder ?? 0, 'number', true); order.min = '0'; order.max = '1000000'; order.step = '1';
    const actions = document.createElement('div'); actions.className = 'account-form-actions';
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary-button account-save'; save.textContent = 'Зберегти';
    actions.append(button('Закрити', function () { host.replaceChildren(); }), save); form.append(actions); host.replaceChildren(form);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (save.disabled || !Shop.validate(form)) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      save.disabled = true; status.textContent = 'Зберігаємо…';
      const data = { name: form.elements.name.value.trim(), description: form.elements.description.value.trim(), sortOrder: Number(form.elements.sortOrder.value) };
      if (!item) data.id = id.value.trim();
      if (kind === 'products') Object.assign(data, {
        category: form.elements.category.value.trim(), price: Number(form.elements.price.value),
        oldPrice: form.elements.oldPrice.value === '' ? null : Number(form.elements.oldPrice.value),
        stock: Number(form.elements.stock.value), image: form.elements.image.value.trim(), alt: form.elements.alt.value.trim(),
        section: form.elements.section.value.trim(), isActive: form.elements.isActive.checked
      });
      else data.icon = form.elements.icon.value.trim();
      try {
        await Store.request('/admin/' + kind + (item ? '/' + encodeURIComponent(item.id) : ''), { method: item ? 'PATCH' : 'POST', auth: true, body: data });
        status.textContent = 'Зміни збережено.'; await reload();
      } catch (error) { status.textContent = error.message; Store.fieldErrors(form, error); }
      finally { save.disabled = false; }
    });
    form.querySelector('input:not(:disabled)').focus();
  }
  async function view(kind, pageNumber) {
    const version = ++generation;
    pageNumber = pageNumber || 1;
    status.textContent = 'Завантажуємо…';
    body.inert = true;
    body.setAttribute('aria-busy', 'true');
    try {
      const url = kind === 'categories' ? '/categories' : '/admin/' + kind + '?limit=10&page=' + pageNumber;
      const result = await Store.request(url, { auth: true });
      if (version !== generation) return;
      body.replaceChildren(); status.textContent = '';
      tabs.querySelectorAll('button').forEach(function (tab) { tab.setAttribute('aria-pressed', String(tab.dataset.kind === kind)); });
      const reload = function () { return view(kind, pageNumber); };
      const editorHost = document.createElement('div'); body.append(editorHost);
      const categories = kind === 'products' ? (await Store.request('/categories')).data : [];
      if (version !== generation) return;
      if (!result.data.length && pageNumber > 1) return view(kind, pageNumber - 1);
      if (kind !== 'orders') body.append(button('Додати', function () { return editor(kind, null, reload, editorHost, categories); }, true));
      result.data.forEach(function (item) {
        const article = document.createElement('article');
        const heading = document.createElement('h3'); heading.className = 'account-panel-title'; heading.textContent = kind === 'orders' ? 'Замовлення №' + item.id.slice(0, 8) : item.name;
        const description = document.createElement('p'); description.className = 'shop-status';
        const actions = document.createElement('div'); actions.className = 'account-form-actions';
        if (kind === 'orders') {
          const labels = { pending: 'Нове', processing: 'В обробці', shipped: 'Відправлено', completed: 'Виконано', cancelled: 'Скасовано' };
          const transitions = { pending: ['processing','cancelled'], processing: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] };
          description.textContent = item.customer.name + ' · ' + item.customer.email + ' · ' + Shop.money(item.total) + ' · ' + labels[item.status];
          actions.append(button('Склад замовлення', async function () {
            const detail = await Store.request('/orders/' + item.id, { auth: true });
            const content = detail.data.items.map(function (entry) { return entry.name + ' × ' + entry.quantity; }).join('; ');
            description.textContent = content + '. Доставка: ' + item.customer.city + ', ' + item.customer.street + '. Телефон: ' + item.customer.phone + '.';
          }));
          transitions[item.status].forEach(function (next) {
            actions.append(button(labels[next], async function () {
              await Store.request('/admin/orders/' + item.id + '/status', { method: 'PATCH', auth: true, body: { status: next } }); await reload();
            }));
          });
        } else {
          description.textContent = kind === 'products' ? Shop.money(item.price) + ' · Залишок: ' + item.stock + ' · ' + (item.isActive ? 'Опубліковано' : 'Приховано') : item.id;
          actions.append(button('Редагувати', function () { return editor(kind, item, reload, editorHost, categories); }), deleteButton(kind, item, reload));
        }
        article.append(heading, description, actions); body.append(article);
      });
      if (!result.data.length) { const empty = document.createElement('p'); empty.textContent = 'Записів поки немає.'; body.append(empty); }
      if (result.pagination && result.pagination.totalPages > 1) {
        const pages = document.createElement('div'); pages.className = 'account-form-actions';
        const previous = button('Назад', function () { return view(kind, pageNumber - 1); }); previous.disabled = pageNumber === 1;
        const next = button('Далі', function () { return view(kind, pageNumber + 1); }); next.disabled = pageNumber >= result.pagination.totalPages;
        pages.append(previous, document.createTextNode(pageNumber + ' / ' + result.pagination.totalPages), next); body.append(pages);
      }
    } catch (error) { status.textContent = error.message; }
    finally {
      if (version === generation) { body.inert = false; body.removeAttribute('aria-busy'); }
    }
  }
  [['products','Товари'],['categories','Категорії'],['orders','Замовлення']].forEach(function (entry) {
    const tab = button(entry[1], function () { return view(entry[0]); }); tab.dataset.kind = entry[0]; tabs.append(tab);
  });
  await view('products');
};
