const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../..');
const out = path.join(__dirname, 'preview');
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4173/web-practice/';
const checks = [], errors = [], expectedMissingImages = [], requests = [];
function check(name, passed, details) { checks.push({ name, passed: !!passed, details }); }
function observe(page, missing = false) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !(missing && m.text().includes('net::ERR_FAILED'))) errors.push(m.text()); });
  page.on('requestfailed', r => {
    if (missing && r.resourceType() === 'image') expectedMissingImages.push(r.url());
    else errors.push(r.url() + ': ' + r.failure()?.errorText);
  });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ': ' + r.url()); });
  page.on('request', r => { if (r.method() !== 'GET') requests.push(r.method() + ' ' + r.url()); });
  page.on('dialog', async d => { errors.push('Unexpected JS dialog: ' + d.type()); await d.dismiss(); });
}
async function load(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 900) {
    await page.evaluate(y => scrollTo(0, y), y);
    await page.waitForTimeout(30);
  }
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, 0));
}
async function geometry(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return { viewport: innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
      height: root.scrollHeight, scrollX,
      clippedNames: [...document.querySelectorAll('.product-name')].filter(e => e.scrollWidth > e.clientWidth + 1).length,
      visibleCards: [...document.querySelectorAll('.product-card')].filter(e => !e.hidden).length };
  });
}
async function capture(page, name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, name + '-full.png'), fullPage: true, animations: 'disabled' });
  await page.screenshot({ path: path.join(out, name + '-top.png'), animations: 'disabled' });
}
async function state1440(page) {
  return page.evaluate(() => {
    const selectors = ['.announcement-bar', '.header-inner', '.desktop-navigation', '.desktop-search', '.hero-section', '.hero-banner', '.hero-copy', '.hero-title', '.hero-image', '.hero-pagination',
      '.flash-section .section-heading-row', '#flash-products', '#flash-products .product-media', '#flash-products .product-image', '.category-grid', '.category-card', '.best-selling-section .product-grid',
      '.promo-banner', '.promo-content', '.promo-title', '.promo-image-wrap img', '#explore-grid', '#explore-grid .product-card', '#explore-grid .product-image', '.arrival-grid', '.arrival-card', '.services-grid', '.service-icon', '.site-footer', '.footer-grid', '.footer-column', '.footer-bottom'];
    return { height: document.documentElement.scrollHeight, boxes: Object.fromEntries(selectors.map(s => [s, [...document.querySelectorAll(s)].map(e => {
      const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, spacing: c.letterSpacing };
    })])) };
  });
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const matrix = [];
  let currentDesktop;
  try {
    for (const width of [320, 360, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      observe(page);
      await load(page);
      const normal = await geometry(page);
      check(width + ': звичайна сторінка без горизонтального скролу', normal.scrollWidth === normal.clientWidth, normal);
      const imageFit = await page.locator('.product-image').evaluateAll(images => images.every(e => getComputedStyle(e).objectFit === 'contain'));
      check(width + ': фото товарів object-fit contain', imageFit);
      if (width < 1280) {
        const contained = await page.locator('.product-image').evaluateAll(images => images.every(e => {
          const image = e.getBoundingClientRect(), media = e.closest('.product-media').getBoundingClientRect();
          return image.left >= media.left - 1 && image.right <= media.right + 1 && image.top >= media.top - 1 && image.bottom <= media.bottom + 1;
        }));
        check(width + ': фото цілком у межах мобільної картки', contained);
        check(width + ': До кошика доступно без hover', await page.locator('.product-add-button').first().evaluate(e => getComputedStyle(e).opacity === '1' && getComputedStyle(e).pointerEvents !== 'none'));
      }
      if (width === 360 || width === 768) {
        await capture(page, 'home-' + width);
        await page.locator('.best-selling-section').screenshot({ path: path.join(out, 'products-' + width + '.png') });
        await page.locator('.promo-section').screenshot({ path: path.join(out, 'jbl-' + width + '.png') });
        await page.locator('.site-footer').screenshot({ path: path.join(out, 'footer-' + width + '.png') });
      }
      if (width === 1440) currentDesktop = await state1440(page);

      await page.evaluate(() => document.querySelectorAll('.product-name').forEach((e, i) => {
        e.textContent = i % 2 ? 'Супердовганазватоварубезпробілів'.repeat(12) : 'Дуже довга назва товару з характеристиками та додатковим описом '.repeat(8);
      }));
      const long = await geometry(page);
      check(width + ': довгі назви без горизонтального скролу', long.scrollWidth === long.clientWidth, long);
      if (width < 1280) check(width + ': довгі назви переносяться', long.clippedNames === 0, long.clippedNames);
      if (width === 360) await page.locator('.best-selling-section').screenshot({ path: path.join(out, 'long-names-360.png') });
      const counts = [];
      for (const count of [0, 1, 3, 11]) {
        await page.evaluate(count => {
          ['flash', 'best', 'explore'].forEach(name => renderProductList(name, Array.from({ length: count }, (_, i) => ({ ...saleProducts[i % saleProducts.length], id: 'qa-' + name + '-' + i }))));
        }, count);
        await page.waitForTimeout(50);
        const g = await geometry(page);
        counts.push({ countPerSection: count, ...g });
        check(width + ': ' + count + ' карток у кожному блоці, без скролу сторінки', g.scrollWidth === g.clientWidth && g.visibleCards === count * 3, g);
        if (count < 2) check(width + ': стрілки порожньої/одиночної стрічки приховані (' + count + ')', await page.locator('[data-scroll="flash-products"]').evaluateAll(buttons => buttons.every(e => e.hidden)));
      }
      matrix.push({ width, normal, long, counts });
      await page.close();

      const missingPage = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      observe(missingPage, true);
      await missingPage.route('**/*', route => /\.(png|webp)(?:\?|$)/i.test(route.request().url()) && !route.request().url().endsWith('/favicon.png') ? route.abort('failed') : route.continue());
      await load(missingPage);
      await missingPage.locator('.product-image').evaluateAll(images => images.forEach(e => { e.loading = 'eager'; }));
      await missingPage.waitForFunction(() => [...document.querySelectorAll('.product-image')].every(e => e.hidden));
      const missing = await geometry(missingPage);
      const fallback = await missingPage.locator('.image-fallback').evaluateAll(items => items.every(e => !e.hidden && e.getBoundingClientRect().width > 0 && e.textContent.includes('недоступне')));
      check(width + ': без растрових зображень — fallback і без скролу', missing.scrollWidth === missing.clientWidth && fallback, missing);
      if (width === 360) await missingPage.locator('.best-selling-section').screenshot({ path: path.join(out, 'missing-images-360.png') });
      await missingPage.close();
    }

    for (const width of [320, 360, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      observe(page);
      await load(page);
      const toggle = page.locator('.menu-toggle');
      const menu = page.locator('.mobile-navigation');
      await toggle.click();
      check(width + ': burger містить навігацію, пошук, 9 категорій', await menu.isVisible() && await menu.locator('.mobile-primary-links li').count() === 6 && await menu.locator('input[type="search"]').isVisible() && await menu.locator('[data-sidebar-filter]').count() === 9);
      check(width + ': меню блокує фон і забирає фокус', await page.evaluate(() => document.querySelector('main').inert && document.querySelector('.mobile-navigation').contains(document.activeElement) && document.body.classList.contains('menu-is-open')));
      await menu.locator('.menu-close').focus();
      await page.keyboard.press('Shift+Tab');
      check(width + ': Shift+Tab не виходить із меню', await page.evaluate(() => document.activeElement === [...document.querySelectorAll('.mobile-navigation button')].at(-1)));
      await page.keyboard.press('Tab');
      check(width + ': Tab повертається до початку меню', await menu.locator('.menu-close').evaluate(e => e === document.activeElement));
      if (width === 360 || width === 768) await page.screenshot({ path: path.join(out, 'menu-' + width + '.png') });
      await page.keyboard.press('Escape');
      check(width + ': Esc закриває меню й повертає фокус', !(await menu.isVisible()) && await toggle.evaluate(e => e === document.activeElement) && !(await page.locator('main').evaluate(e => e.inert)));
      await toggle.click(); await menu.locator('.menu-close').click();
      check(width + ': кнопка закриття меню', !(await menu.isVisible()));
      await toggle.click(); await page.mouse.click(width - 2, 20);
      check(width + ': клік на фоні закриває меню', !(await menu.isVisible()));
      await toggle.click(); await menu.locator('a[href="#categories"]').click();
      check(width + ': навігація закриває меню і переходить до секції', !(await menu.isVisible()) && page.url().endsWith('#categories'));
      await toggle.click(); await menu.locator('#mobile-search').fill('ASUS'); await menu.locator('.search-submit').click();
      check(width + ': пошук із меню фільтрує товари', !(await menu.isVisible()) && await page.locator('.product-card:visible').count() === 1 && (await page.locator('.product-card:visible .product-name').textContent()).includes('ASUS'));
      await toggle.click(); await menu.locator('#mobile-search').fill(''); await menu.locator('.search-submit').click();
      await toggle.click(); await menu.locator('[data-sidebar-filter="electronics"]').click();
      check(width + ': категорія з меню фільтрує й закриває меню', !(await menu.isVisible()) && await page.locator('.product-card:visible').count() > 0 && await page.locator('.product-card:visible').count() < 18);
      await toggle.click(); await page.setViewportSize({ width: 1024, height: 800 });
      check(width + ': перехід на desktop прибирає меню та inert', !(await menu.isVisible()) && !(await page.locator('main').evaluate(e => e.inert)) && !(await page.locator('body').evaluate(e => e.classList.contains('menu-is-open'))));
      await page.close();
    }

    for (const width of [320, 360, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      observe(page);
      await load(page);
      const dialog = page.locator('.auth-dialog');
      const mobile = width < 1024;
      async function open(mode = 'register') {
        if (mobile) {
          await page.locator('.menu-toggle').click();
          await page.locator('.mobile-navigation [data-open-auth]').click();
        } else await page.locator('.desktop-navigation [data-open-auth]').click();
        if ((await page.locator('[data-auth-mode="' + mode + '"]').getAttribute('aria-selected')) !== 'true') await page.locator('[data-auth-mode="' + mode + '"]').click();
      }
      const focusRestored = () => (mobile ? page.locator('.menu-toggle') : page.locator('.desktop-navigation [data-open-auth]')).evaluate(e => e === document.activeElement);
      await open(mobile ? 'register' : 'login');
      check(width + ': модалка фокусується на першому видимому полі', await page.locator(mobile ? '#auth-name' : '#auth-email').evaluate(e => e === document.activeElement));
      const bounds = await dialog.boundingBox();
      check(width + ': модалка всередині екрана', bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 801 && await dialog.evaluate(e => e.scrollWidth === e.clientWidth), bounds);
      for (let i = 0; i < 16; i++) await page.keyboard.press('Tab');
      check(width + ': Tab лишає фокус у модалці', await dialog.evaluate(e => e.contains(document.activeElement)));
      for (let i = 0; i < 16; i++) await page.keyboard.press('Shift+Tab');
      check(width + ': Shift+Tab лишає фокус у модалці', await dialog.evaluate(e => e.contains(document.activeElement)));
      await dialog.locator('.dialog-close').click();
      check(width + ': кнопка закриття і повернення фокусу', !(await dialog.isVisible()) && await focusRestored());
      await open(); await page.mouse.click(2, 2);
      check(width + ': клік поза модалкою й повернення фокусу', !(await dialog.isVisible()) && await focusRestored());
      await open(); await page.keyboard.press('Escape');
      check(width + ': Esc і повернення фокусу', !(await dialog.isVisible()) && await focusRestored() && !(await page.locator('body').evaluate(e => e.classList.contains('dialog-is-open'))));
      await open();
      await page.locator('#auth-title').click();
      check(width + ': клік усередині не закриває модалку', await dialog.isVisible());
      await page.locator('.form-submit').click();
      check(width + ': порожня реєстрація — помилки й фокус імені', await page.locator('.auth-form [aria-invalid="true"]').count() >= 4 && await page.locator('#auth-name').evaluate(e => e === document.activeElement));
      await page.locator('#auth-name').fill('Студентка');
      await page.locator('#auth-email').fill('wrong@email');
      await page.locator('#auth-password').fill('short');
      await page.locator('#auth-confirm-password').fill('different');
      await page.locator('.form-submit').click();
      check(width + ': некоректний email, короткий пароль, незбіг і згода відхилені', await page.locator('.auth-form [aria-invalid="true"]').count() === 4 && await page.locator('#auth-email').evaluate(e => e === document.activeElement));
      await page.locator('#auth-email').fill('student@example.com');
      await page.locator('#auth-password').fill('demoPass123');
      await page.locator('#auth-confirm-password').fill('demoPass123');
      await page.locator('#auth-consent').check();
      await page.locator('.form-submit').click();
      check(width + ': валідна реєстрація дає чесний демостатус', await page.locator('.auth-form [aria-invalid="true"]').count() === 0 && (await page.locator('[data-form-status]').textContent()).includes('Реєстрацію буде підключено'));
      if (width === 360 || width === 768) await page.screenshot({ path: path.join(out, 'modal-' + width + '.png') });
      await page.locator('[data-auth-mode="register"]').focus();
      await page.keyboard.press('ArrowRight');
      check(width + ': вкладки працюють клавішами-стрілками', await page.locator('[data-auth-mode="login"]').evaluate(e => e === document.activeElement && e.getAttribute('aria-selected') === 'true'));
      await page.locator('#auth-email').fill(''); await page.locator('#auth-password').fill(''); await page.locator('.form-submit').click();
      check(width + ': вхід перевіряє лише email і пароль', await page.locator('.auth-form [aria-invalid="true"]').count() === 2 && await page.locator('#auth-email').evaluate(e => e === document.activeElement));
      await page.locator('#auth-email').fill('student@example.com'); await page.locator('#auth-password').fill('demoPass123'); await page.locator('.form-submit').click();
      check(width + ': валідний вхід дає демостатус', (await page.locator('[data-form-status]').textContent()).includes('Вхід буде підключено'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.auth-dialog').open && document.getElementById('auth-password').value === '');
      check(width + ': закриття очищує пароль і помилки', await page.locator('#auth-password').inputValue() === '' && await page.locator('.auth-form [aria-invalid="true"]').count() === 0);
      await open(); await page.setViewportSize({ width, height: 480 });
      await page.locator('.form-submit').scrollIntoViewIfNeeded();
      check(width + ': на низькому екрані форма прокручується всередині', await dialog.evaluate(e => e.getBoundingClientRect().height <= 480 && e.scrollWidth === e.clientWidth) && await page.locator('.form-submit').evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height: 800 });
      await page.locator('.hero-dot').first().click();
      check(width + ': перемикання hero-слайду', (await page.locator('[data-hero-title]').textContent()) === 'Музика без меж' && await page.locator('.hero-dot').first().getAttribute('aria-current') === 'true');
      await page.locator('[data-scroll="flash-products"][data-direction="1"]').click();
      await page.waitForTimeout(650);
      const scroll = await page.locator('#flash-products').evaluate(e => ({ left: e.scrollLeft, width: e.scrollWidth, client: e.clientWidth }));
      check(width + ': стрілка прокручує стрічку товарів', scroll.left > 0 || scroll.width <= scroll.client, scroll);
      const g = await geometry(page);
      check(width + ': після взаємодій сторінка не прокручується вбік', g.scrollWidth === g.clientWidth, g);
      await page.close();
    }

    const intermediatePage = await browser.newPage({ reducedMotion: 'reduce' });
    observe(intermediatePage);
    const intermediate = [];
    for (const width of [480, 639, 640, 769, 800, 1023, 1199, 1200, 1249, 1279, 1280, 1920]) {
      await intermediatePage.setViewportSize({ width, height: 900 });
      await intermediatePage.goto(base, { waitUntil: 'networkidle' });
      const g = await geometry(intermediatePage);
      intermediate.push(g);
      check(width + ': додаткова проміжна ширина без скролу сторінки', g.scrollWidth === g.clientWidth, g);
    }
    await intermediatePage.close();

    for (const width of [360, 768]) {
      const touchPage = await browser.newPage({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      observe(touchPage);
      await load(touchPage);
      const g = await geometry(touchPage);
      check(width + ': touch-емуляція без скролу і з доступною кнопкою До кошика', g.scrollWidth === g.clientWidth && await touchPage.locator('.product-add-button').first().evaluate(e => getComputedStyle(e).opacity === '1'), g);
      await touchPage.screenshot({ path: path.join(out, 'touch-home-' + width + '.png') });
      await touchPage.locator('.menu-toggle').tap();
      check(width + ': burger відкривається дотиком', await touchPage.locator('.mobile-navigation').isVisible());
      await touchPage.locator('.menu-close').tap();
      await touchPage.close();
    }

    const desktopBaseline = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const oldCss = execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', 'safe.directory=' + repo.replace(/\\/g, '/'), 'show', '5ef6366:assets/css/style.css'], { cwd: repo, encoding: 'utf8' });
    await desktopBaseline.route('**/assets/css/style.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: oldCss }));
    await load(desktopBaseline);
    const baseline = await state1440(desktopBaseline);
    const desktopDifferences = [];
    for (const [selector, boxes] of Object.entries(baseline.boxes)) boxes.forEach((box, i) => {
      const current = currentDesktop.boxes[selector][i];
      for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(box[key] - current[key]) > 1) desktopDifferences.push({ selector, i, key, before: box[key], current: current[key] });
      for (const key of ['font', 'size', 'weight', 'lineHeight', 'spacing']) if (box[key] !== current[key]) desktopDifferences.push({ selector, i, key, before: box[key], current: current[key] });
    });
    check('1440: геометрія і типографіка основних компонентів збережені', !desktopDifferences.length && baseline.height === currentDesktop.height, desktopDifferences);
    await desktopBaseline.close();

    const clockPage = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce', timezoneId: 'Europe/Kyiv' });
    observe(clockPage);
    await clockPage.clock.install({ time: new Date('2027-01-31T23:58:58+02:00') });
    await clockPage.clock.pauseAt(new Date('2027-01-31T23:59:58+02:00'));
    await clockPage.goto(base, { waitUntil: 'networkidle' });
    const times = () => clockPage.locator('[data-countdown]').evaluateAll(roots => roots.map(r => ({ end: r.dataset.countdownEnd, seconds: r.querySelector('[data-countdown-seconds]').textContent, expired: !r.querySelector('[data-countdown-expired]').hidden })));
    check('Обидва таймери активні за секунду до 31.01.2027 23:59:59 за Києвом', (await times()).every(t => t.end === '2027-01-31T23:59:59+02:00' && t.seconds === '01' && !t.expired));
    await clockPage.clock.runFor(1000);
    check('Обидва таймери завершуються в заданий момент', (await times()).every(t => t.seconds === '00' && t.expired));
    await clockPage.reload({ waitUntil: 'networkidle' });
    check('Перезавантаження не відновлює завершені акції', (await times()).every(t => t.expired));
    await clockPage.close();

    check('Немає неочікуваних JS, console і Network помилок', errors.length === 0, errors);
    check('Демонстраційні форми не надсилають дані на сервер', requests.length === 0, requests);
    const css = fs.readFileSync(path.join(repo, 'assets/css/style.css'), 'utf8');
    check('Mobile First: усі ширинні медіазапити використовують min-width', !/@media[^{}]*max-width/i.test(css));
    fs.writeFileSync(path.join(__dirname, 'preview-checks.json'), JSON.stringify({ date: '2026-10-25', status: 'Попередня версія, очікує перевірки користувачки', browser: await browser.version(), base, checks, matrix, intermediate, desktopDifferences,
      passed: checks.filter(c => c.passed).length, count: checks.length, errors, expectedMissingImages: expectedMissingImages.length,
      scope: 'Edge, адаптивні viewport. Це не випробування на фізичних телефонах і не повна матриця браузерів.' }, null, 2) + '\n');
    console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, count: checks.length, failed: checks.filter(c => !c.passed) }, null, 2));
    if (checks.some(c => !c.passed)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
