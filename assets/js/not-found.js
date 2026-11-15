'use strict';

document.querySelectorAll('.search-form').forEach(function (form) {
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    closeMobileMenu();
    window.StoreReady.then(function (api) { api.search(form.querySelector('input').value); }).catch(function (error) { showToast(error.message); });
  });
});
