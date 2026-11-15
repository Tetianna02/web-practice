'use strict';

window.FormValidation = (function () {
  function clear(form) {
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(function (error) { error.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (input) { input.removeAttribute('aria-invalid'); });
  }

  function errorFor(input, message) {
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/);
    const error = ids.map(function (id) { return document.getElementById(id); }).find(function (element) {
      return element && element.classList.contains('field-error');
    });
    if (error) error.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function validate(form, mode) {
    clear(form);
    const field = function (name) {
      const input = form.elements.namedItem(name);
      return input && !input.disabled && !input.closest('[hidden]') ? input : null;
    };
    const name = field('name');
    const email = field('email');
    const password = field('password');
    const confirmation = field('confirmPassword');
    const consent = field('consent');
    if (mode === 'register' && name && name.value.trim().length < 2) {
      errorFor(name, 'Введіть ім’я (щонайменше 2 символи).');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email.value.trim())) {
      errorFor(email, 'Введіть коректну адресу електронної пошти.');
    }
    if (password && (!password.value.trim() || password.value.length < 8)) {
      errorFor(password, 'Пароль має містити щонайменше 8 символів.');
    } else if (password && new TextEncoder().encode(password.value).length > 72) {
      errorFor(password, 'Пароль має бути не довшим за 72 байти UTF-8.');
    }
    if (mode === 'register' && confirmation && password) {
      if (!confirmation.value) errorFor(confirmation, 'Підтвердьте пароль.');
      else if (confirmation.value !== password.value) errorFor(confirmation, 'Паролі не збігаються.');
    }
    if (mode === 'register' && consent && !consent.checked) {
      errorFor(consent, 'Потрібна згода з умовами.');
    }
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function bind(form, options) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (options.status) options.status.textContent = '';
      const mode = typeof options.mode === 'function' ? options.mode() : options.mode;
      if (validate(form, mode)) options.onValid();
    });
  }

  return { clear: clear, validate: validate, bind: bind };
})();
