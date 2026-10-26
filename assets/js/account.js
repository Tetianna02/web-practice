'use strict';

(function () {
  const form = document.querySelector('[data-profile-form]');
  const status = document.querySelector('[data-profile-status]');
  const current = document.getElementById('account-current-password');
  const password = document.getElementById('account-new-password');
  const confirmation = document.getElementById('account-confirm-password');
  const profilePanel = document.querySelector('[data-account-panel="profile"]');
  const ordersPanel = document.querySelector('[data-account-panel="orders"]');
  function switchPanel(name, focus) {
    const orders = name === 'orders';
    profilePanel.hidden = orders;
    ordersPanel.hidden = !orders;
    document.querySelector('[data-show-account="profile"]').setAttribute('aria-current', orders ? 'false' : 'page');
    document.querySelector('[data-show-account="orders"]').setAttribute('aria-current', orders ? 'page' : 'false');
    if (focus) (orders ? ordersPanel : profilePanel).querySelector('h2').focus();
  }
  document.querySelectorAll('[data-show-account]').forEach(function (button) {
    button.addEventListener('click', function () { switchPanel(button.dataset.showAccount, true); });
  });
  function applyHash() { switchPanel(window.location.hash === '#orders' ? 'orders' : 'profile', false); }
  window.addEventListener('hashchange', applyHash);
  applyHash();
  form.querySelector('[type="submit"]').disabled = false;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    status.textContent = '';
    const validProfile = Shop.validate(form);
    const changingPassword = Boolean(current.value || password.value || confirmation.value);
    if (changingPassword) {
      [current, password, confirmation].forEach(function (input) {
        if (!input.value) Shop.fieldError(input, 'Заповніть усі поля зміни пароля.');
      });
      if (password.value && password.value.length < 8) Shop.fieldError(password, 'Новий пароль має містити щонайменше 8 символів.');
      if (confirmation.value && confirmation.value !== password.value) Shop.fieldError(confirmation, 'Паролі не збігаються.');
    }
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) { firstInvalid.focus(); return; }
    if (!validProfile) return;
    status.textContent = 'Дані перевірено. Це демонстрація: зміни профілю та пароль не збережено.';
    current.value = ''; password.value = ''; confirmation.value = '';
    showToast('Дані профілю перевірено');
  });
  form.addEventListener('reset', function () {
    Shop.clearErrors(form);
    status.textContent = '';
  });
})();
