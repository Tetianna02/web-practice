'use strict';

const iconSprite = 'assets/images/icons/sprite.svg#icon-';
const categories = [
  { id: 'phones', name: 'Телефони', icon: 'phone' },
  { id: 'computers', name: 'Комп’ютери', icon: 'computer' },
  { id: 'smartwatch', name: 'Смартгодинники', icon: 'smartwatch' },
  { id: 'camera', name: 'Камери', icon: 'camera' },
  { id: 'headphones', name: 'Навушники', icon: 'headphones' },
  { id: 'gaming', name: 'Ігрові товари', icon: 'gaming' }
];

const sidebarCategories = [
  { name: 'Одяг та взуття', filter: 'clothing' },
  { name: 'Електроніка', filter: 'electronics', expandable: true },
  { name: 'Дім і стиль життя', filter: 'home' },
  { name: 'Здоров’я та краса', filter: 'beauty' },
  { name: 'Спорт і відпочинок', filter: 'sports' },
  { name: 'Дитячі товари', filter: 'children', expandable: true },
  { name: 'Товари для тварин', filter: 'pets' }
];

const saleProducts = [
  { id: 'gamepad-havit', name: 'Бездротовий ігровий контролер Havit', category: 'gaming', price: 1199, oldPrice: 1999, discount: 40, rating: 5, reviews: 88, image: 'product-gamepad-havit.webp', alt: 'Червоний ігровий контролер Havit' },
  { id: 'keyboard-ak900', name: 'Ігрова клавіатура AK-900 з підсвічуванням', category: 'computers', price: 2599, oldPrice: 3999, discount: 35, rating: 4, reviews: 75, image: 'product-keyboard-ak900.webp', alt: 'Чорна клавіатура AK-900' },
  { id: 'monitor-ips', name: 'Монітор IPS для ігор та роботи', category: 'computers', price: 7499, oldPrice: 9999, discount: 25, rating: 5, reviews: 99, image: 'product-monitor-ips.webp', alt: 'Монітор із тонкою рамкою' },
  { id: 'comfort-chair', name: 'Ергономічне крісло для дому й офісу', category: 'home', price: 5499, oldPrice: 6999, discount: 21, rating: 4, reviews: 99, image: 'product-chair-comfort.webp', alt: 'Сіре м’яке крісло' },
  { id: 'asus-laptop', name: 'Ноутбук ASUS для роботи та розваг', category: 'computers', price: 28999, oldPrice: 32999, discount: 12, rating: 5, reviews: 325, image: 'product-laptop-asus.webp', alt: 'Ноутбук ASUS з відкритим екраном' },
  { id: 'canon-camera', name: 'Цифрова камера Canon для подорожей', category: 'camera', price: 14999, oldPrice: 16999, discount: 12, rating: 4, reviews: 95, image: 'product-camera-canon.webp', alt: 'Цифрова камера Canon' }
];

const bestProducts = [
  { id: 'north-coat', name: 'Тепле пальто North', category: 'clothing', price: 9999, oldPrice: 13999, rating: 5, reviews: 65, image: 'product-coat-north.webp', alt: 'Рожеве зимове пальто' },
  { id: 'gucci-bag', name: 'Шкіряна сумка на кожен день', category: 'clothing', price: 12999, oldPrice: 15999, rating: 4, reviews: 65, image: 'product-bag-gucci.webp', alt: 'Шкіряна сумка з кольоровою стрічкою' },
  { id: 'cpu-cooler', name: 'Система охолодження для ПК', category: 'computers', price: 3499, oldPrice: 3999, rating: 4, reviews: 65, image: 'product-cpu-cooler.webp', alt: 'Система охолодження з RGB-підсвічуванням' },
  { id: 'bookshelf', name: 'Компактна книжкова полиця', category: 'home', price: 2299, rating: 5, reviews: 65, image: 'product-bookshelf.webp', alt: 'Дерев’яна книжкова полиця' }
];

const exploreProducts = [
  { id: 'dog-food', name: 'Сухий корм для собак із куркою та овочами', category: 'pets', price: 799, rating: 4, reviews: 35, image: 'product-dog-food.webp', alt: 'Паковання сухого корму для собак' },
  { id: 'canon-eos', name: 'Фотоапарат Canon EOS для створення чітких кадрів', category: 'camera', price: 21999, rating: 4, reviews: 95, image: 'product-camera-canon.webp', alt: 'Фотоапарат Canon з об’єктивом' },
  { id: 'gaming-laptop', name: 'Ігровий ноутбук ASUS із великим екраном', category: 'computers', price: 34999, rating: 5, reviews: 325, image: 'product-laptop-asus.webp', alt: 'Ігровий ноутбук ASUS' },
  { id: 'skin-care', name: 'Набір засобів для щоденного догляду за шкірою обличчя', category: 'beauty', price: 1299, rating: 4, reviews: 145, image: 'product-cosmetics-curology.webp', alt: 'Набір косметичних засобів' },
  { id: 'toy-car', name: 'Дитячий електромобіль з ременем безпеки та музикою', category: 'children', price: 8999, rating: 5, reviews: 65, image: 'product-toy-car.webp', alt: 'Червоний дитячий електромобіль' },
  { id: 'football-cleats', name: 'Футбольні бутси з надійною фіксацією стопи', category: 'sports', price: 2899, rating: 5, reviews: 35, image: 'product-shoes-cleats.webp', alt: 'Футбольні бутси жовтого кольору' },
  { id: 'wireless-gamepad', name: 'Бездротовий контролер для комп’ютера та консолі', category: 'gaming', price: 1699, rating: 4, reviews: 55, image: 'product-gamepad-fantech.webp', alt: 'Чорний бездротовий ігровий контролер' },
  { id: 'satin-jacket', name: 'Сатинова куртка вільного крою для прохолодної погоди', category: 'clothing', price: 3299, rating: 4, reviews: 55, image: 'product-jacket-satin.webp', alt: 'Темно-зелена сатинова куртка' }
];

const heroSlides = [
  { eyebrow: 'iPhone 14 Series', title: 'Знижка до 10% на вибрані товари', description: 'Техніка для роботи, навчання та відпочинку.', image: 'figma-hero-iphone.webp', alt: 'Фіолетовий смартфон iPhone 14' },
  { eyebrow: 'Аудіотехніка JBL', title: 'Чистий звук для улюбленої музики', description: 'Відкрийте для себе портативні колонки JBL.', image: 'figma-jbl-boombox.webp', alt: 'Портативна колонка JBL Boombox' },
  { eyebrow: 'PlayStation 5', title: 'Більше можливостей для гри', description: 'Знайдіть техніку та аксесуари для дозвілля.', image: 'figma-arrival-ps5.webp', alt: 'Ігрова консоль PlayStation 5' },
  { eyebrow: 'Техніка для творчості', title: 'Збережіть важливі моменти', description: 'Камери й аксесуари для ваших історій.', image: 'product-camera-canon.webp', alt: 'Цифрова камера Canon' },
  { eyebrow: 'Товари для дому', title: 'Комфорт у кожній деталі', description: 'Практичні речі для дому та щоденного життя.', image: 'product-chair-comfort.webp', alt: 'Сіре м’яке крісло для дому' }
];

function createIcon(name, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('class', className || 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', iconSprite + name);
  svg.append(use);
  return svg;
}

function formatPrice(value) {
  return new Intl.NumberFormat('uk-UA').format(value) + ' ₴';
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productName = product.name.toLocaleLowerCase('uk-UA');
  card.dataset.category = product.category || '';
  card.dataset.productId = product.id;

  const media = document.createElement('div');
  media.className = 'product-media';

  if (product.discount) {
    const badge = document.createElement('span');
    badge.className = 'product-badge';
    badge.textContent = '-' + product.discount + '%';
    media.append(badge);
  } else if (product.isNew) {
    const badge = document.createElement('span');
    badge.className = 'product-badge is-new';
    badge.textContent = 'Новинка';
    media.append(badge);
  }

  const image = document.createElement('img');
  image.className = 'product-image';
  image.src = 'assets/images/optimized/' + product.image;
  image.alt = product.alt || product.name;
  image.loading = 'lazy';
  image.decoding = 'async';

  const fallback = document.createElement('span');
  fallback.className = 'image-fallback';
  fallback.textContent = 'Зображення тимчасово недоступне';
  fallback.hidden = true;
  image.addEventListener('error', function () {
    image.hidden = true;
    fallback.hidden = false;
  }, { once: true });

  const tools = document.createElement('div');
  tools.className = 'product-tools';
  const favorite = document.createElement('button');
  favorite.className = 'product-tool';
  favorite.type = 'button';
  favorite.setAttribute('aria-label', 'Додати товар до обраного');
  favorite.dataset.comingSoon = '';
  favorite.append(createIcon('heart'));
  tools.append(favorite);

  media.append(image, fallback, tools);

  const addButton = document.createElement('button');
  addButton.className = 'product-add-button';
  addButton.type = 'button';
  addButton.textContent = 'До кошика';
  addButton.dataset.comingSoon = '';
  media.append(addButton);

  const name = document.createElement('h3');
  name.className = 'product-name';
  name.textContent = product.name;

  const prices = document.createElement('div');
  prices.className = 'product-prices';
  const currentPrice = document.createElement('span');
  currentPrice.className = 'product-price-current';
  currentPrice.textContent = formatPrice(product.price);
  prices.append(currentPrice);
  if (product.oldPrice) {
    const oldPrice = document.createElement('span');
    oldPrice.className = 'product-price-old';
    oldPrice.textContent = formatPrice(product.oldPrice);
    prices.append(oldPrice);
  }

  const rating = document.createElement('div');
  rating.className = 'product-rating';
  const stars = document.createElement('span');
  stars.setAttribute('aria-label', 'Оцінка ' + product.rating + ' з 5');
  stars.textContent = '★'.repeat(Math.max(0, Math.min(5, Math.round(product.rating || 0))));
  const reviewCount = document.createElement('span');
  reviewCount.className = 'product-rating-count';
  reviewCount.textContent = '(' + (product.reviews || 0) + ')';
  rating.append(stars, reviewCount);

  card.append(media, name, prices, rating);
  return card;
}

function renderProductList(name, products) {
  const container = document.querySelector('[data-product-list="' + name + '"]');
  if (!container) return;
  container.replaceChildren();
  products.forEach(function (product) {
    container.append(createProductCard(product));
  });
}

renderProductList('flash', saleProducts);
renderProductList('best', bestProducts);
renderProductList('explore', exploreProducts);

function createCategoryButton(category, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className || '';
  button.dataset.categoryFilter = category.id;
  button.setAttribute('aria-pressed', 'false');
  const icon = createIcon(category.icon);
  const label = document.createElement('span');
  label.textContent = category.name;
  button.append(icon, label);
  return button;
}

categories.forEach(function (category) {
  const grid = document.querySelector('[data-category-grid]');
  if (grid) grid.append(createCategoryButton(category, 'category-card'));
});

const mobileCategoryList = document.querySelector('[data-category-list="mobile"]');
if (mobileCategoryList) {
  sidebarCategories.forEach(function (category) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sidebarFilter = category.filter;
    const label = document.createElement('span');
    label.textContent = category.name;
    button.append(label);
    if (category.expandable) button.append(createIcon('arrow-right'));
    item.append(button);
    mobileCategoryList.append(item);
  });
}

const desktopCategoryList = document.querySelector('[data-category-list="desktop"]');
if (desktopCategoryList) {
  sidebarCategories.forEach(function (category) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sidebarFilter = category.filter;
    button.textContent = category.name;
    if (category.expandable) button.append(createIcon('arrow-right'));
    item.append(button);
    desktopCategoryList.append(item);
  });
}

let activeCategory = null;
let activeQuery = '';
const searchStatus = document.querySelector('[data-search-status]');

function updateProductVisibility() {
  const cards = Array.from(document.querySelectorAll('.product-card'));
  let visible = 0;
  cards.forEach(function (card) {
    const matchesQuery = !activeQuery || card.dataset.productName.includes(activeQuery);
    const matchesCategory = !activeCategory || card.dataset.category === activeCategory || (activeCategory === 'electronics' && ['phones', 'computers', 'smartwatch', 'camera', 'headphones', 'gaming'].includes(card.dataset.category));
    const show = matchesQuery && matchesCategory;
    card.hidden = !show;
    if (show) visible += 1;
  });
  if (searchStatus && (activeQuery || activeCategory)) {
    searchStatus.textContent = visible ? 'Знайдено товарних карток: ' + visible : 'За цим запитом товарів не знайдено.';
  } else if (searchStatus) {
    searchStatus.textContent = '';
  }
}

function selectCategory(categoryId) {
  activeCategory = activeCategory === categoryId ? null : categoryId;
  document.querySelectorAll('[data-category-filter]').forEach(function (button) {
    const selected = button.dataset.categoryFilter === activeCategory;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  updateProductVisibility();
  const target = document.getElementById('explore-products');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', function (event) {
  const categoryButton = event.target.closest('[data-category-filter]');
  if (categoryButton) {
    selectCategory(categoryButton.dataset.categoryFilter);
    return;
  }
  const sidebarButton = event.target.closest('[data-sidebar-filter]');
  if (sidebarButton) {
    const filter = sidebarButton.dataset.sidebarFilter;
    activeCategory = activeCategory === filter ? null : filter;
    updateProductVisibility();
    showToast('Категорію обрано. Перегляньте товари нижче.');
    document.getElementById('explore-products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMobileMenu();
  }
});

document.querySelectorAll('.search-form').forEach(function (form) {
  const input = form.querySelector('input[type="search"]');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    activeQuery = input.value.trim().toLocaleLowerCase('uk-UA');
    updateProductVisibility();
    const target = document.getElementById('explore-products');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMobileMenu();
  });
});

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
    showToast('Буде доступно на наступному етапі');
  }
});

const mobileMenu = document.querySelector('.mobile-navigation');
const menuToggle = document.querySelector('.menu-toggle');
const menuBackdrop = document.querySelector('.menu-backdrop');
const menuClose = document.querySelector('.menu-close');

function openMobileMenu() {
  if (!mobileMenu || !menuToggle || window.matchMedia('(min-width: 769px)').matches) return;
  mobileMenu.hidden = false;
  menuBackdrop.hidden = false;
  document.body.classList.add('menu-is-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Закрити меню');
  const firstLink = mobileMenu.querySelector('input, a, button');
  if (firstLink) firstLink.focus();
}

function closeMobileMenu() {
  if (!mobileMenu || !menuToggle) return;
  mobileMenu.hidden = true;
  menuBackdrop.hidden = true;
  document.body.classList.remove('menu-is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Відкрити меню');
}

if (menuToggle) {
  menuToggle.addEventListener('click', function () {
    if (menuToggle.getAttribute('aria-expanded') === 'true') closeMobileMenu();
    else openMobileMenu();
  });
}
if (menuClose) menuClose.addEventListener('click', closeMobileMenu);
if (menuBackdrop) menuBackdrop.addEventListener('click', closeMobileMenu);
window.addEventListener('resize', function () {
  if (window.matchMedia('(min-width: 769px)').matches) closeMobileMenu();
});

const authDialog = document.querySelector('.auth-dialog');
const authForm = document.querySelector('.auth-form');
const authStatus = document.querySelector('[data-form-status]');
const authNameField = document.querySelector('[data-field="name"]');
const authConfirmField = document.querySelector('[data-field="confirm-password"]');
const authConsentField = document.querySelector('[data-field="consent"]');
const authPassword = document.getElementById('auth-password');
let authMode = 'register';
let lastAuthTrigger = null;

function openAuthDialog(trigger) {
  const triggerIsInMobileMenu = trigger && mobileMenu && mobileMenu.contains(trigger);
  closeMobileMenu();
  if (!authDialog || typeof authDialog.showModal !== 'function') return;
  lastAuthTrigger = triggerIsInMobileMenu ? menuToggle : (trigger || document.activeElement);
  authDialog.showModal();
  const firstField = authDialog.querySelector('input:not([type="checkbox"])');
  if (firstField) firstField.focus();
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === 'register';
  if (authNameField) authNameField.hidden = !isRegister;
  if (authConfirmField) authConfirmField.hidden = !isRegister;
  if (authConsentField) authConsentField.hidden = !isRegister;
  const nameInput = document.getElementById('auth-name');
  const confirmInput = document.getElementById('auth-confirm-password');
  const consentInput = document.getElementById('auth-consent');
  if (nameInput) nameInput.required = isRegister;
  if (confirmInput) confirmInput.required = isRegister;
  if (consentInput) consentInput.required = isRegister;
  if (authPassword) authPassword.autocomplete = isRegister ? 'new-password' : 'current-password';
  document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
    button.setAttribute('aria-selected', String(button.dataset.authMode === mode));
  });
  const submit = document.querySelector('.form-submit');
  if (submit) submit.textContent = isRegister ? 'Створити обліковий запис' : 'Увійти';
  if (authStatus) authStatus.textContent = '';
  clearFormErrors();
}

document.querySelectorAll('[data-open-auth]').forEach(function (trigger) {
  trigger.addEventListener('click', function () {
    openAuthDialog(trigger);
  });
});
document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
  button.addEventListener('click', function () {
    setAuthMode(button.dataset.authMode);
  });
});

function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach(function (error) {
    error.textContent = '';
  });
  document.querySelectorAll('.auth-form input').forEach(function (input) {
    input.removeAttribute('aria-invalid');
  });
}

function setFieldError(fieldName, message, input) {
  const error = document.getElementById('auth-' + fieldName + '-error');
  if (error) error.textContent = message;
  if (input) input.setAttribute('aria-invalid', 'true');
}

if (authForm) {
  authForm.addEventListener('submit', function (event) {
    event.preventDefault();
    clearFormErrors();
    if (authStatus) authStatus.textContent = '';
    let valid = true;
    const nameInput = document.getElementById('auth-name');
    const emailInput = document.getElementById('auth-email');
    const confirmInput = document.getElementById('auth-confirm-password');
    const consentInput = document.getElementById('auth-consent');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

    if (authMode === 'register' && nameInput.value.trim().length < 2) {
      setFieldError('name', 'Введіть ім’я (щонайменше 2 символи).', nameInput);
      valid = false;
    }
    if (!emailPattern.test(emailInput.value.trim())) {
      setFieldError('email', 'Введіть коректну адресу електронної пошти.', emailInput);
      valid = false;
    }
    if (authPassword.value.length < 8) {
      setFieldError('password', 'Пароль має містити щонайменше 8 символів.', authPassword);
      valid = false;
    }
    if (authMode === 'register' && confirmInput.value !== authPassword.value) {
      setFieldError('confirm-password', 'Паролі не збігаються.', confirmInput);
      valid = false;
    }
    if (authMode === 'register' && !consentInput.checked) {
      setFieldError('consent', 'Потрібна згода з умовами.', consentInput);
      valid = false;
    }

    if (!valid) {
      const firstInvalid = authForm.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    if (authStatus) {
      authStatus.textContent = authMode === 'register'
        ? 'Дані перевірено. Реєстрацію буде підключено на наступному етапі.'
        : 'Дані перевірено. Вхід буде підключено на наступному етапі.';
    }
  });
}

const dialogClose = document.querySelector('.dialog-close');
if (dialogClose && authDialog) {
  dialogClose.addEventListener('click', function () {
    authDialog.close();
  });
}
if (authDialog) {
  authDialog.addEventListener('click', function (event) {
    if (event.target !== authDialog) return;
    const bounds = authDialog.getBoundingClientRect();
    const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (clickedOutside) authDialog.close();
  });
  authDialog.addEventListener('close', function () {
    clearFormErrors();
    if (authForm) authForm.reset();
    setAuthMode('register');
    if (lastAuthTrigger && typeof lastAuthTrigger.focus === 'function') lastAuthTrigger.focus();
  });
}

const flashDuration = 4 * 24 * 60 * 60 * 1000;
const jblDuration = 6 * 24 * 60 * 60 * 1000;

function getSaleEnd(key, duration) {
  const fallback = Date.now() + duration;
  try {
    const saved = Number(window.localStorage.getItem(key));
    if (Number.isFinite(saved) && saved > 0) return saved;
    window.localStorage.setItem(key, String(fallback));
  } catch (error) {
    return fallback;
  }
  return fallback;
}

function updateCountdown(root, endAt) {
  const remaining = Math.max(0, endAt - Date.now());
  const expired = remaining <= 0;
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const values = { days: days, hours: hours, minutes: minutes, seconds: seconds };
  Object.keys(values).forEach(function (part) {
    root.querySelectorAll('[data-countdown-' + part + ']').forEach(function (element) {
      element.textContent = String(values[part]).padStart(2, '0');
    });
  });
  const message = root.querySelector('[data-countdown-expired]');
  if (expired) {
    const timer = root.querySelector('.countdown');
    if (timer) timer.hidden = true;
    if (message) message.hidden = false;
  }
}

const countdownDefinitions = [
  { selector: '[data-countdown="flash"]', key: 'exclusive:flash-sale-end', duration: flashDuration },
  { selector: '[data-countdown="jbl"]', key: 'exclusive:jbl-sale-end', duration: jblDuration }
];

countdownDefinitions.forEach(function (definition) {
  const root = document.querySelector(definition.selector);
  if (!root) return;
  const endAt = getSaleEnd(definition.key, definition.duration);
  updateCountdown(root, endAt);
  window.setInterval(function () {
    updateCountdown(root, endAt);
  }, 1000);
});

const heroEyebrow = document.querySelector('[data-hero-eyebrow]');
const heroTitle = document.querySelector('[data-hero-title]');
const heroDescription = document.querySelector('[data-hero-description]');
const heroImage = document.querySelector('[data-hero-image]');
const heroPagination = document.querySelector('[data-hero-pagination]');
let currentSlide = 0;
let slideTimer = null;

function showHeroSlide(index) {
  currentSlide = (index + heroSlides.length) % heroSlides.length;
  const slide = heroSlides[currentSlide];
  heroEyebrow.textContent = slide.eyebrow;
  heroTitle.textContent = slide.title;
  heroDescription.textContent = slide.description;
  heroImage.src = 'assets/images/optimized/' + slide.image;
  heroImage.alt = slide.alt;
  heroPagination.querySelectorAll('button').forEach(function (dot, dotIndex) {
    dot.setAttribute('aria-current', String(dotIndex === currentSlide));
  });
}

if (heroPagination && heroEyebrow && heroTitle && heroImage) {
  heroSlides.forEach(function (slide, index) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'hero-dot';
    dot.setAttribute('aria-label', 'Показати слайд ' + (index + 1) + ': ' + slide.eyebrow);
    dot.addEventListener('click', function () {
      showHeroSlide(index);
      restartHeroTimer();
    });
    heroPagination.append(dot);
  });
  showHeroSlide(0);

  function restartHeroTimer() {
    if (slideTimer) window.clearInterval(slideTimer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slideTimer = window.setInterval(function () {
        showHeroSlide(currentSlide + 1);
      }, 6500);
    }
  }
  restartHeroTimer();
  const hero = document.querySelector('.hero-banner');
  hero.addEventListener('mouseenter', function () {
    if (slideTimer) window.clearInterval(slideTimer);
  });
  hero.addEventListener('mouseleave', restartHeroTimer);
  hero.addEventListener('focusin', function () {
    if (slideTimer) window.clearInterval(slideTimer);
  });
  hero.addEventListener('focusout', restartHeroTimer);
}

document.querySelectorAll('[data-scroll]').forEach(function (button) {
  const target = document.getElementById(button.dataset.scroll);
  if (!target) {
    button.hidden = true;
    return;
  }
  const updateControl = function () {
    button.hidden = target.scrollWidth <= target.clientWidth + 2;
  };
  updateControl();
  window.addEventListener('resize', updateControl);
  button.addEventListener('click', function () {
    const direction = Number(button.dataset.direction) || 1;
    const amount = Math.max(180, target.clientWidth * 0.75) * direction;
    target.scrollBy({ left: amount, behavior: 'smooth' });
  });
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
