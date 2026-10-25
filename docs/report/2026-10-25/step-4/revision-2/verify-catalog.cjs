const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../../..');
const base = 'http://127.0.0.1:4173/web-practice/';
const checks = [], matrix = [], errors = [], expectedFailures = [];
const check = (name, passed, details) => checks.push({ name, passed: !!passed, details });
const settle = p => p.waitForTimeout(45);
function observe(p) {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) errors.push(m.text()); });
  p.on('requestfailed', r => (r.url().includes('qa-missing') ? expectedFailures : errors).push(r.url()));
  p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  p.on('dialog', async d => { errors.push(d.type()); await d.dismiss(); });
}
async function load(p) { await p.goto(base, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); }
async function data(p, n, stress = false) {
  await p.evaluate(({ n, stress }) => {
    activeCategory = null; activeQuery = '';
    renderProductList('explore', Array.from({ length: n }, (_, i) => ({ ...exploreProducts[i % 8], id: 'qa-' + i,
      ...(stress ? { name: 'НадзвичайноДовгаНазваБезПробілів'.repeat(20), image: 'qa-missing.webp' } : {}) })));
    if (stress) document.querySelectorAll('#explore-grid img').forEach(e => { e.loading = 'eager'; });
  }, { n, stress });
  if (stress && n) await p.waitForFunction(() => [...document.querySelectorAll('#explore-grid img')].every(e => e.hidden));
  await settle(p);
}
async function metrics(p) {
  return p.evaluate(() => {
    const e = document.getElementById('explore-grid'), s = getComputedStyle(e);
    const cards = [...e.children].filter(c => !c.hidden);
    const buttons = [...document.querySelectorAll('[data-scroll="explore-grid"]')];
    return { width: innerWidth, railWidth: e.clientWidth, cardWidth: cards[0]?.getBoundingClientRect().width || 0,
      gap: parseFloat(s.columnGap), left: e.scrollLeft, max: Math.max(0, e.scrollWidth - e.clientWidth), height: e.getBoundingClientRect().height,
      rows: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))].length, visible: cards.length,
      hidden: buttons.every(b => b.hidden), previousDisabled: buttons[0].disabled, nextDisabled: buttons[1].disabled,
      flow: s.gridAutoFlow, templateRows: s.gridTemplateRows, snap: s.scrollSnapType, scrollbar: s.scrollbarWidth,
      pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight };
  });
}
async function capture(p, selector, filename) {
  await p.locator('img').evaluateAll(async es => { es.forEach(e => { e.loading = 'eager'; }); await Promise.all(es.map(e => e.decode().catch(() => {}))); });
  for (let y = 0; y < await p.evaluate(() => document.documentElement.scrollHeight); y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40); }
  await p.waitForLoadState('networkidle'); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(100);
  const rect = await p.locator(selector).boundingBox();
  await p.screenshot({ path: path.join(__dirname, filename), fullPage: true, clip: rect, animations: 'disabled' });
}
async function swipe(p, direction) {
  await p.locator('#explore-grid').evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 180));
  const r = await p.locator('#explore-grid').boundingBox(), y = r.y + 80;
  const x1 = direction > 0 ? r.x + r.width - 24 : r.x + 24, x2 = direction > 0 ? r.x + 24 : r.x + r.width - 24;
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 12, y }] }); await p.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(650); await cdp.detach();
}
async function state(p) {
  return p.evaluate(() => ({ height: document.documentElement.scrollHeight, boxes: Object.fromEntries([
    '.header-inner', '.hero-banner', '.hero-title', '.hero-image', '.flash-section .section-heading-row', '#flash-products', '.category-grid', '.category-card', '.best-selling-section .product-grid',
    '.promo-banner', '.promo-title', '.explore-section .section-heading-row', '#explore-grid', '#explore-grid .product-card', '#explore-grid .product-media', '#explore-grid .product-image', '#explore-grid .product-swatches',
    '.explore-section .section-action-row', '.arrival-grid', '.arrival-card', '.arrival-card > img', '.services-grid', '.site-footer', '.footer-grid'
  ].map(s => [s, [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return {
    x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, spacing: c.letterSpacing };
  })])) }));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    for (const width of [360, 768, 1024, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); observe(p);
      await p.route('**/qa-missing.webp', r => r.abort('failed')); await load(p);
      const sizes = [];
      const prev = p.locator('[data-scroll="explore-grid"][data-direction="-1"]'), next = p.locator('[data-scroll="explore-grid"][data-direction="1"]');
      for (const n of [0, 1, 8, 11, 100]) {
        await data(p, n); let m = await metrics(p); sizes.push({ count: n, ...m });
        const label = width + '/' + n;
        check(label + ': усі товари, потрібна кількість рядів', m.visible === n && m.rows === Math.min(n, width >= 1024 ? 2 : 1) && m.flow === 'column', m);
        check(label + ': без скролу документа, snap і клавіатурний фокус', m.pageScroll === m.pageWidth && m.snap.includes('mandatory') && m.scrollbar === 'none' && await p.locator('#explore-grid').getAttribute('tabindex') === '0');
        if (m.max <= 2) check(label + ': все вміщується — стрілки приховані й disabled', m.hidden && m.previousDisabled && m.nextDisabled, m);
        else {
          check(label + ': початок — попередня disabled', !m.hidden && m.previousDisabled && !m.nextDisabled);
          let forward = 0, backward = 0, firstStep = 0;
          while ((await metrics(p)).left < (await metrics(p)).max - 2 && forward < n + 2) {
            const before = await p.locator('#explore-grid').evaluate(e => e.scrollLeft); await next.click(); await settle(p);
            if (!forward) firstStep = (await p.locator('#explore-grid').evaluate(e => e.scrollLeft)) - before;
            forward++;
          }
          m = await metrics(p);
          check(label + ': стрілкою до кінця, next disabled', m.left >= m.max - 2 && m.nextDisabled && !m.previousDisabled, { ...m, forward });
          check(label + ': крок максимум 2/4 колонки', firstStep > 0 && firstStep <= (m.cardWidth + m.gap) * (width >= 1024 ? 4 : 2) + 2, firstStep);
          while ((await metrics(p)).left > 2 && backward < n + 2) { await prev.click(); await settle(p); backward++; }
          m = await metrics(p);
          check(label + ': стрілкою назад, previous disabled', m.left <= 2 && m.previousDisabled && !m.nextDisabled, { backward });
          await next.focus(); await p.keyboard.press('Tab');
          check(label + ': Tab зі стрілки у стрічку', await p.locator('#explore-grid').evaluate(e => e === document.activeElement));
          await p.keyboard.press('End'); await settle(p); const end = await metrics(p);
          await p.keyboard.press('Home'); await settle(p); const home = await metrics(p);
          await p.keyboard.press('ArrowRight'); await settle(p); const right = await metrics(p);
          await p.keyboard.press('ArrowLeft'); await settle(p); const left = await metrics(p);
          check(label + ': Home/End/ліворуч/праворуч і disabled', end.nextDisabled && home.previousDisabled && right.left > 0 && left.left <= 2 && left.previousDisabled);
        }
        await data(p, n, true); const stress = await metrics(p);
        check(label + ': довгі назви/відсутні фото не збільшують висоту чи ширину', Math.abs(stress.height - sizes.at(-1).height) <= 1 && Math.abs(stress.pageHeight - sizes.at(-1).pageHeight) <= 1 && stress.pageScroll === stress.pageWidth && stress.rows === Math.min(n, width >= 1024 ? 2 : 1), stress);
        if (n) check(label + ': усі недоступні фото мають fallback', await p.locator('#explore-grid .image-fallback').evaluateAll(es => es.every(e => !e.hidden)));
      }
      check(width + ': висота стрічки й усієї сторінки стала для 0/1/8/11/100', Math.max(...sizes.map(s => s.height)) - Math.min(...sizes.map(s => s.height)) <= 1 && Math.max(...sizes.map(s => s.pageHeight)) - Math.min(...sizes.map(s => s.pageHeight)) <= 1, sizes.map(s => ({ n: s.count, rail: s.height, page: s.pageHeight })));
      await p.evaluate(() => {
        renderProductList('explore', Array.from({ length: 100 }, (_, i) => ({ ...exploreProducts[i % 8], id: 'filter-' + i, name: i < 50 ? 'Перша' : 'Друга', category: i < 50 ? 'computers' : 'home' })));
        const f = document.querySelector('.search-form'); f.querySelector('input').value = 'Друга'; f.requestSubmit();
      }); await settle(p);
      check(width + ': пошук показує всі 50 збігів, без ліміту 8', await p.locator('#explore-grid .product-card:not([hidden])').count() === 50);
      await p.evaluate(() => selectCategory('computers')); await settle(p);
      check(width + ': нуль збігів приховує стрілки', (await metrics(p)).hidden && await p.locator('#explore-grid .product-card:not([hidden])').count() === 0);
      await p.evaluate(() => { const f = document.querySelector('.search-form'); f.querySelector('input').value = ''; f.requestSubmit(); }); await settle(p);
      check(width + ': очищення пошуку зберігає категорію, повертає 50', await p.locator('#explore-grid .product-card:not([hidden])').count() === 50 && (await metrics(p)).previousDisabled);
      await p.locator('.explore-section .section-action-row button').click();
      check(width + ': Усі товари дає правильний toast, дозавантаження прибране', (await p.locator('.toast-message').last().textContent()) === 'Буде доступно на наступному етапі' && (await p.locator('.explore-section .section-action-row button').textContent()) === 'Усі товари' && await p.locator('[data-load-more]').count() === 0);
      matrix.push({ width, sizes }); await p.close(); console.log('Перевірено каталог ' + width);
    }
    for (const width of [360, 768, 1024, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'no-preference' }); observe(p); await load(p); await data(p, 11);
      await swipe(p, 1); const after = await metrics(p); await swipe(p, -1); const back = await metrics(p);
      check(width + ': touch-свайп в обидва боки, без скролу документа', after.left > 0 && back.left < after.left && back.pageScroll === back.pageWidth, { after: after.left, back: back.left });
      await p.locator('#explore-grid').focus(); await p.keyboard.press('Home');
      await p.waitForFunction(() => document.querySelector('[data-scroll="explore-grid"][data-direction="-1"]').disabled);
      await p.locator('[data-scroll="explore-grid"][data-direction="1"]').click(); await p.waitForTimeout(750);
      check(width + ': плавна прокрутка стрілкою', (await metrics(p)).left > 0);
      await p.close();
    }
    const heroBefore = JSON.parse(fs.readFileSync(path.join(__dirname, 'hero-before.json'), 'utf8'));
    const heroRows = [];
    for (const width of [640, 700, 768, 900, 1023]) {
      const p = await browser.newPage({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); observe(p); await load(p);
      const boxes = await p.evaluate(() => Object.fromEntries(['.hero-banner', '.hero-copy', '.hero-image'].map(s => [s, document.querySelector(s).getBoundingClientRect().toJSON()])));
      const image = boxes['.hero-image'], text = boxes['.hero-copy'], banner = boxes['.hero-banner'];
      const old = heroBefore.find(r => r.width === width).boxes['.hero-image'];
      heroRows.push({ width, before: old.width, after: image.width, increase: (image.width / old.width - 1) * 100, boxes });
      check(width + ': hero — фото ціле, пропорційне, не перетинає текст', image.x >= text.right + 11 && image.right <= banner.right && image.top >= banner.top && image.bottom <= banner.bottom && Math.abs(image.width / image.height - 496 / 328) < 0.01, boxes);
      check(width + ': hero не розширює документ', await p.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
      if (width === 768) check('768: iPhone збільшено на 30%', Math.abs(image.width / old.width - 1.3) < 0.001, image.width);
      await capture(p, '.hero-banner', 'hero-' + width + '.png'); await p.close();
    }
    for (const width of [360, 768, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 1024, hasTouch: width < 1024, deviceScaleFactor: 1, reducedMotion: 'reduce' }); observe(p); await load(p);
      await capture(p, '.explore-section', 'catalog-' + width + '.png');
      await data(p, 11); await capture(p, '.explore-section', 'catalog-' + width + '-11.png'); await p.close();
    }
    const current = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); await load(current); const now = await state(current);
    const git = file => execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', 'safe.directory=' + repo.replace(/\\/g, '/'), 'show', '5ef6366:' + file], { cwd: repo, encoding: 'utf8' });
    const old = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await old.route(base, r => r.fulfill({ status: 200, contentType: 'text/html', body: git('index.html') }));
    await old.route('**/assets/css/style.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: git('assets/css/style.css') }));
    await old.route('**/assets/js/main.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: git('assets/js/main.js') }));
    await load(old); const before = await state(old), desktopDifferences = [];
    for (const [selector, boxes] of Object.entries(before.boxes)) boxes.forEach((a, i) => { const b = now.boxes[selector][i];
      for (const key of ['x', 'y', 'w', 'h']) if (Math.abs(a[key] - b[key]) > 1) desktopDifferences.push({ selector, i, key, before: a[key], after: b[key] });
      for (const key of ['font', 'size', 'weight', 'lineHeight', 'spacing']) if (a[key] !== b[key]) desktopDifferences.push({ selector, i, key, before: a[key], after: b[key] });
    });
    check('1440: desktop-геометрія, порядок товарів, шрифти збережені; висота 5902', !desktopDifferences.length && now.height === 5902, desktopDifferences);
    await current.close(); await old.close();
    check('Немає неочікуваних JS/Console/Network помилок', errors.length === 0, errors);
    const report = { date: '2026-10-25', status: 'Перегляд користувачкою, крок 4 не фіналізований', checks, matrix, heroRows, desktopDifferences, errors, expectedImageFailures: expectedFailures.length,
      passed: checks.filter(c => c.passed).length, count: checks.length, browser: await browser.version(), scope: 'Edge, адаптивні viewport і CDP touch-емуляція; не фізичні телефони.' };
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, count: report.count, failed: checks.filter(c => !c.passed) }, null, 2));
    if (checks.some(c => !c.passed)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
