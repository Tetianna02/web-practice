'use strict';

function initializeAccountPage(mode) {
  const form = document.querySelector('[data-account-form]');
  const status = form.querySelector('[data-form-status]');
  FormValidation.bind(form, {
    mode: mode,
    status: status,
    onValid: function () {
      status.textContent = mode === 'register'
        ? 'Дані перевірено. Реєстрацію буде підключено на наступному етапі. Дані не надсилаються й не зберігаються.'
        : 'Дані перевірено. Вхід буде підключено на наступному етапі. Дані не надсилаються й не зберігаються.';
      showToast(comingSoonMessage);
    }
  });
  form.querySelector('[type="submit"]').disabled = false;

  document.querySelectorAll('.search-form').forEach(function (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      closeMobileMenu();
      showToast(comingSoonMessage);
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
