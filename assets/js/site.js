'use strict';

const comingSoonMessage = 'Буде доступно на наступному етапі';

function showToast(message) {
  const region = document.querySelector('.toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(function () {
    toast.remove();
  }, 2800);
}

document.addEventListener('click', function (event) {
  const comingSoon = event.target.closest('[data-coming-soon]');
  if (comingSoon) {
    event.preventDefault();
    showToast(comingSoonMessage);
  }
});

const mobileMenu = document.querySelector('.mobile-navigation');
const menuToggle = document.querySelector('.menu-toggle');
const menuBackdrop = document.querySelector('.menu-backdrop');
const menuClose = document.querySelector('.menu-close');
const menuBackground = document.querySelectorAll('.skip-link, .announcement-bar, .site-header, main, .site-footer, .scroll-top');
const desktopMenuQuery = window.matchMedia('(min-width: 1024px)');

function menuFocusableElements() {
  return Array.from(mobileMenu.querySelectorAll('a[href], button, input')).filter(function (element) {
    return !element.disabled && element.getClientRects().length > 0;
  });
}

function openMobileMenu() {
  if (!mobileMenu || !menuToggle || desktopMenuQuery.matches) return;
  mobileMenu.hidden = false;
  menuBackdrop.hidden = false;
  document.body.classList.add('menu-is-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Закрити меню');
  menuBackground.forEach(function (element) { element.inert = true; });
  const firstLink = mobileMenu.querySelector('input, a, button');
  if (firstLink) firstLink.focus();
}

function closeMobileMenu() {
  if (!mobileMenu || !menuToggle) return;
  const wasOpen = !mobileMenu.hidden;
  mobileMenu.hidden = true;
  menuBackdrop.hidden = true;
  document.body.classList.remove('menu-is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Відкрити меню');
  menuBackground.forEach(function (element) { element.inert = false; });
  if (wasOpen && !desktopMenuQuery.matches) menuToggle.focus({ preventScroll: true });
}

if (menuToggle) {
  menuToggle.addEventListener('click', function () {
    if (menuToggle.getAttribute('aria-expanded') === 'true') closeMobileMenu();
    else openMobileMenu();
  });
}
if (menuClose) menuClose.addEventListener('click', closeMobileMenu);
if (menuBackdrop) menuBackdrop.addEventListener('click', closeMobileMenu);
if (mobileMenu) {
  mobileMenu.addEventListener('click', function (event) {
    if (event.target.closest('a[href], [data-coming-soon]')) closeMobileMenu();
  });
  mobileMenu.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileMenu();
    } else if (event.key === 'Tab') {
      const items = menuFocusableElements();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}
window.addEventListener('resize', function () {
  if (desktopMenuQuery.matches) closeMobileMenu();
});

const scrollTopButton = document.querySelector('.scroll-top');
const siteHeader = document.querySelector('.site-header');
function updateScrollState() {
  const scrolled = window.scrollY > 30;
  if (siteHeader) siteHeader.classList.toggle('is-scrolled', scrolled);
  if (scrollTopButton) scrollTopButton.classList.toggle('is-visible', window.scrollY > 500);
}
window.addEventListener('scroll', updateScrollState, { passive: true });
updateScrollState();
if (scrollTopButton) {
  scrollTopButton.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const subscribeForm = document.querySelector('[data-subscribe]');
if (subscribeForm) {
  subscribeForm.addEventListener('submit', function (event) {
    event.preventDefault();
    showToast(comingSoonMessage);
  });
}
