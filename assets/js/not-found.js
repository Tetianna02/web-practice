'use strict';

document.querySelectorAll('.search-form').forEach(function (form) {
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    closeMobileMenu();
    showToast(comingSoonMessage);
  });
});
