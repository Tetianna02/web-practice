'use strict';

window.Store = (function () {
  const scriptUrl = document.currentScript.src;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const deployedApi = '';
  const base = (window.STORE_API_URL || (local ? 'http://' + location.hostname + ':3000/api' : deployedApi)).replace(/\/$/, '');
  const sessionKey = 'exclusive-supabase-auth-v1';
  let session = null;
  let userPromise = null;
  let catalogPromise = null;
  let refreshPromise = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey));
    if (saved && typeof saved.token === 'string' && typeof saved.refreshToken === 'string' && Number.isFinite(Date.parse(saved.expiresAt))) session = saved;
    else sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem('exclusive-auth-v1');
  } catch (_) { /* The current page can still work without browser storage. */ }

  class ApiError extends Error {
    constructor(message, status, fields) { super(message); this.status = status || 0; this.fields = fields || {}; }
  }

  function setSession(value) {
    session = value ? { token: value.token, refreshToken: value.refreshToken, expiresAt: value.expiresAt } : null;
    userPromise = value ? Promise.resolve(value.user) : null;
    try {
      if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
      else sessionStorage.removeItem(sessionKey);
    } catch (_) { /* Never store passwords or contact details here. */ }
    window.dispatchEvent(new CustomEvent('store:auth-change'));
  }

  async function refreshSession() {
    if (!session?.refreshToken) throw new ApiError('Увійдіть у свій акаунт.', 401);
    if (!refreshPromise) {
      const previous = session;
      refreshPromise = request('/auth/refresh', { method: 'POST', body: { refreshToken: previous.refreshToken } }).then(function (value) {
        if (session !== previous) {
          if (!session) throw new ApiError('Сеанс завершено.', 401);
          return;
        }
        setSession(value);
      }).catch(function (error) {
        if (error.status === 401 && session === previous) setSession(null);
        throw error;
      }).finally(function () { refreshPromise = null; });
    }
    return refreshPromise;
  }

  async function ensureSession() {
    if (!session) throw new ApiError('Увійдіть у свій акаунт.', 401);
    if (Date.parse(session.expiresAt) <= Date.now() + 30000) await refreshSession();
  }

  async function request(endpoint, options) {
    options = options || {};
    if (!base) throw new ApiError('Сервер ще не опубліковано. Поки відкрийте сайт через локальний сервер.');
    if (options.auth) await ensureSession();
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 25000);
    try {
      const headers = { Accept: 'application/json' };
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.auth) headers.Authorization = 'Bearer ' + session.token;
      const response = await fetch(base + endpoint, {
        method: options.method || 'GET', headers: headers, signal: controller.signal,
        credentials: 'omit', cache: 'no-store',
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) {
        if (options.auth && response.status === 401) {
          if (!options.refreshed && session?.refreshToken) {
            await refreshSession();
            return request(endpoint, Object.assign({}, options, { refreshed: true }));
          }
          setSession(null);
          if (/\/(account|checkout)\.html$/.test(location.pathname)) location.assign(loginUrl());
        }
        throw new ApiError(data.message || 'Не вдалося виконати запит.', response.status, data.fields);
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error.name === 'AbortError'
        ? 'Сервер відповідає задовго. Спробуйте ще раз.'
        : 'Не вдалося з’єднатися із сервером. Перевірте, чи він запущений.');
    } finally { clearTimeout(timeout); }
  }

  function page(file, params) {
    const url = new URL('/web-practice/' + file, location.origin);
    if (params) Object.keys(params).forEach(function (key) { if (params[key] !== undefined) url.searchParams.set(key, params[key]); });
    return url.pathname + url.search + url.hash;
  }
  function productUrl(id) { return page('product.html', { id: id }); }
  function loginUrl() { return page('login.html', { next: location.pathname + location.search + location.hash }); }
  function afterLogin() {
    const next = new URLSearchParams(location.search).get('next');
    if (next) {
      try {
        const url = new URL(next, location.origin);
        if (url.origin === location.origin && url.pathname.startsWith('/web-practice/')
            && !/\/(login|signup)\.html$/.test(url.pathname)) return url.pathname + url.search + url.hash;
      } catch (_) { /* Invalid return paths use the account page. */ }
    }
    return page('account.html');
  }

  async function currentUser(force) {
    if (!session) return null;
    if (!userPromise || force) userPromise = request('/auth/me', { auth: true }).then(function (result) { return result.data; }).catch(function (error) {
      userPromise = null;
      if (error.status === 401) return null;
      throw error;
    });
    return userPromise;
  }
  async function requireUser() {
    const user = await currentUser();
    if (!user) { location.assign(loginUrl()); throw new ApiError('Потрібно увійти в акаунт.', 401); }
    return user;
  }
  async function authenticate(mode, input) {
    const result = await request('/auth/' + (mode === 'register' ? 'register' : 'login'), { method: 'POST', body: input });
    if (!result.token || !result.refreshToken || !result.expiresAt) {
      throw new ApiError('Запущено попередню версію сервера. Перезапустіть Node.js для Supabase Auth.', 503);
    }
    setSession(result);
    return result.user;
  }
  async function logout() {
    try { if (session) await request('/auth/logout', { method: 'POST', auth: true }); }
    catch (error) { if (error.status !== 401) throw error; }
    setSession(null);
    location.assign(page('login.html'));
  }
  async function catalog(force) {
    if (!catalogPromise || force) catalogPromise = (async function () {
      let pageNumber = 1;
      let result;
      const items = [];
      do {
        result = await request('/products?limit=100&page=' + pageNumber);
        items.push.apply(items, result.data);
        pageNumber += 1;
      } while (pageNumber <= result.pagination.totalPages);
      return items;
    })().catch(function (error) { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function search(query) { location.assign(page('', { q: query.trim() }) + '#explore-products'); }
  function uuid() { return crypto.randomUUID(); }
  function loadScript(name) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = new URL(name, scriptUrl).href;
      script.onload = resolve;
      script.onerror = function () { reject(new ApiError('Не вдалося завантажити модуль. Оновіть сторінку.')); };
      document.head.append(script);
    });
  }
  function fieldErrors(form, error, mapping) {
    Object.keys(error.fields || {}).forEach(function (name) {
      const field = form.elements.namedItem((mapping || {})[name] || name);
      if (!field || !field.id) return;
      field.setAttribute('aria-invalid', 'true');
      const message = document.getElementById(field.id + '-error');
      if (message) message.textContent = error.fields[name];
    });
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
  }
  async function updateAccountLinks() {
    let user;
    try { user = await currentUser(); } catch (_) { return; }
    if (!user) return;
    document.querySelectorAll('a[href$="/login.html"], a[href="login.html"]').forEach(function (link) {
      if (link.closest('main')) return;
      link.textContent = 'Акаунт'; link.href = page('account.html');
    });
    document.querySelectorAll('a[href$="/signup.html"], a[href="signup.html"]').forEach(function (link) {
      if (link.closest('main')) return;
      link.textContent = 'Вийти'; link.href = page('login.html'); link.dataset.storeLogout = '';
    });
    document.querySelectorAll('.shop-account-menu button').forEach(function (button) {
      if (!button.textContent.includes('Вийти')) return;
      button.removeAttribute('data-coming-soon'); button.dataset.storeLogout = '';
    });
  }
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-store-logout]');
    if (!button) return;
    event.preventDefault();
    if (button.getAttribute('aria-busy') === 'true') return;
    button.setAttribute('aria-busy', 'true');
    try { await logout(); } catch (error) { showToast(error.message); }
    finally { button.removeAttribute('aria-busy'); }
  });
  window.addEventListener('store:auth-change', updateAccountLinks);
  window.addEventListener('pageshow', function (event) { if (event.persisted) location.reload(); });
  const descriptions = {
    'login.html': 'Увійдіть до свого акаунта Exclusive, щоб переглядати профіль і замовлення.',
    'signup.html': 'Створіть акаунт Exclusive для покупок, збереження профілю та перегляду замовлень.',
    'account.html': 'Ваш профіль Exclusive: контактні дані, зміна пароля та історія замовлень.',
    'checkout.html': 'Оформіть замовлення Exclusive: перевірте товари, контактні дані та адресу доставки.'
  };
  const description = descriptions[location.pathname.split('/').pop()];
  if (description) document.querySelector('meta[name="description"]').content = description;
  updateAccountLinks();
  return { request: request, page: page, productUrl: productUrl, loginUrl: loginUrl, afterLogin: afterLogin,
    currentUser: currentUser, requireUser: requireUser, authenticate: authenticate, logout: logout,
    catalog: catalog, search: search, uuid: uuid, loadScript: loadScript, fieldErrors: fieldErrors,
    updateUser: function (user) { userPromise = Promise.resolve(user); }, updateSession: setSession, ApiError: ApiError };
})();
