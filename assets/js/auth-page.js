'use strict';

function initializeAccountPage(mode) {
  const form = document.querySelector('[data-account-form]');
  const status = form.querySelector('[data-form-status]');
  FormValidation.bind(form, {
    mode: mode,
    status: status,
    onValid: async function () {
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status.textContent = mode === 'register' ? 'Створюємо акаунт…' : 'Входимо…';
      try {
        const api = await window.StoreReady;
        const input = { email: form.elements.email.value.trim(), password: form.elements.password.value };
        if (mode === 'register') input.name = form.elements.name.value.trim();
        await api.authenticate(mode, input);
        form.elements.password.value = '';
        location.assign(api.afterLogin());
      } catch (error) {
        status.textContent = error.message;
        if (window.Store) Store.fieldErrors(form, error);
      } finally {
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    }
  });
  form.querySelector('[type="submit"]').disabled = false;
  const next = new URLSearchParams(location.search).get('next');
  if (next) {
    window.StoreReady.then(function (api) {
      document.querySelectorAll('a[href$="signup.html"], a[href$="login.html"]').forEach(function (link) {
        link.href = api.page(link.getAttribute('href').includes('signup.html') ? 'signup.html' : 'login.html', { next: next });
      });
    }).catch(function () {});
  }

  document.querySelectorAll('.search-form').forEach(function (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      closeMobileMenu();
      window.StoreReady.then(function (api) { api.search(searchForm.querySelector('input').value); }).catch(function (error) { showToast(error.message); });
    });
  });

  const image = document.querySelector('.account-art img');
  function showFallback() {
    image.hidden = true;
    document.querySelector('.account-image-fallback').hidden = false;
  }
  image.addEventListener('error', showFallback);
  if (image.complete && !image.naturalWidth) showFallback();
}
