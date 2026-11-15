'use strict';

(function () {
  const dialog = document.getElementById('product-question-dialog');
  const trigger = document.querySelector('[data-open-product-question]');
  if (!dialog || !trigger) return;
  const form = dialog.querySelector('form');
  let pointerStartedOutside = false;

  function outside(event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  trigger.disabled = false;
  trigger.addEventListener('click', function () {
    dialog.showModal();
    document.body.classList.add('dialog-is-open');
    document.getElementById('question-name').focus();
  });
  dialog.querySelector('[data-close-product-question]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('pointerdown', function (event) {
    pointerStartedOutside = event.target === dialog && outside(event);
  });
  dialog.addEventListener('click', function (event) {
    if (pointerStartedOutside && event.target === dialog && outside(event)) dialog.close();
    pointerStartedOutside = false;
  });
  dialog.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab') return;
    const fields = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
    const first = fields[0];
    const last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', function () {
    document.body.classList.remove('dialog-is-open');
    form.reset();
    Shop.clearErrors(form);
    pointerStartedOutside = false;
    trigger.focus({ preventScroll: true });
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!Shop.validate(form)) return;
    dialog.close();
    showToast('Дякуємо! Демонстраційний режим: запитання перевірено, надсилання менеджеру ще не підключене.');
  });
})();
