const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../../..');
const base = 'http://127.0.0.1:4173/web-practice/';
const checks = [], errors = [], matrix = [], expectedImageFailures = [];
function check(name, ok, details) { checks.push({ name, passed: !!ok, details }); }
async function settle(page) { await page.waitForTimeout(45); }
function observe(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) errors.push(m.text()); });
  page.on('requestfailed', r => {
    if (r.url().includes('qa-missing')) expectedImageFailures.push(r.url());
    else errors.push(r.url() + ': ' + r.failure()?.errorText);
  });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ': ' + r.url()); });
}
async function load(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}
async function metrics(page, id) {
  return page.evaluate(id => {
    const e = document.getElementById(id), r = e.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('[data-scroll="' + id + '"]')];
    const cards = [...e.children].filter(c => !c.hidden);
    return { id, client: e.clientWidth, scroll: e.scrollWidth, left: e.scrollLeft, max: Math.max(0, e.scrollWidth - e.clientWidth), height: r.height,
      cardWidth: cards[0]?.getBoundingClientRect().width || 0, gap: parseFloat(getComputedStyle(e).columnGap),
      rows: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))].length,
      hidden: buttons.every(b => b.hidden), previousDisabled: buttons[0].disabled, nextDisabled: buttons[1].disabled,
      snap: getComputedStyle(e).scrollSnapType, scrollbar: getComputedStyle(e).scrollbarWidth,
      pageClient: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight };
  }, id);
}
async function inject(page, count, long = false, missing = false) {
  await page.evaluate(({ count, long, missing }) => {
    const name = long ? 'ДужеДовгаНазваТоваруБезПробілів'.repeat(18) : 'Навчальний товар';
    renderProductList('flash', Array.from({ length: count }, (_, i) => ({ ...saleProducts[0], id: 'qa-' + i, name, image: missing ? 'qa-missing.webp' : saleProducts[0].image })));
    const grid = document.getElementById('category-grid');
    grid.replaceChildren(...Array.from({ length: count }, (_, i) => createCategoryButton({ ...categories[i % categories.length], name: long && i !== 0 ? 'ДовгаНазваКатегорії'.repeat(12) : 'Смартгодинники' }, 'category-card')));
    if (missing) document.querySelectorAll('#flash-products img').forEach(e => { e.loading = 'eager'; });
    document.getElementById('flash-products').scrollLeft = 0;
    grid.scrollLeft = 0;
  }, { count, long, missing });
  if (missing && count) await page.waitForFunction(() => [...document.querySelectorAll('#flash-products img')].every(e => e.hidden));
  await settle(page);
}
async function walkArrows(page, id, count, label) {
  const rail = page.locator('#' + id);
  const prev = page.locator('[data-scroll="' + id + '"][data-direction="-1"]');
  const next = page.locator('[data-scroll="' + id + '"][data-direction="1"]');
  let m = await metrics(page, id);
  check(label + ': один рядок, snap, схована смуга, фокусована область', m.rows <= 1 && m.snap.includes('mandatory') && m.scrollbar === 'none' && await rail.getAttribute('tabindex') === '0', m);
  check(label + ': сторінка не розширена', m.pageScroll === m.pageClient, m);
  if (m.max <= 2) {
    check(label + ': все вміщується — стрілки приховані', m.hidden && m.previousDisabled && m.nextDisabled, m);
    return { ...m, forward: 0, backward: 0 };
  }
  check(label + ': початок — попередня disabled', !m.hidden && m.previousDisabled && !m.nextDisabled, m);
  let forward = 0, oneStep = 0;
  while (!(await next.isDisabled()) && forward < count + 2) {
    const before = await rail.evaluate(e => e.scrollLeft);
    await next.click();
    await settle(page);
    if (!forward) oneStep = (await rail.evaluate(e => e.scrollLeft)) - before;
    forward += 1;
  }
  m = await metrics(page, id);
  check(label + ': стрілкою до кінця, наступна disabled', m.left >= m.max - 2 && m.nextDisabled && !m.previousDisabled, m);
  const stride = m.cardWidth + m.gap;
  check(label + ': крок не більше двох карток', oneStep > 0 && oneStep <= stride * 2 + 2, { oneStep, stride });
  let backward = 0;
  while (!(await prev.isDisabled()) && backward < count + 2) { await prev.click(); await settle(page); backward += 1; }
  m = await metrics(page, id);
  check(label + ': стрілкою назад, попередня disabled', m.left <= 2 && m.previousDisabled && !m.nextDisabled, m);
  await rail.focus();
  await page.keyboard.press('End'); await settle(page);
  const end = await metrics(page, id);
  await page.keyboard.press('Home'); await settle(page);
  const home = await metrics(page, id);
  await page.keyboard.press('ArrowRight'); await settle(page);
  const right = await metrics(page, id);
  await page.keyboard.press('ArrowLeft'); await settle(page);
  const left = await metrics(page, id);
  check(label + ': клавіатура Home/End/стрілки й disabled', end.nextDisabled && end.left >= end.max - 2 && home.previousDisabled && right.left > 0 && left.left <= 2 && left.previousDisabled);
  return { ...m, forward, backward };
}
async function desktopState(page) {
  return page.evaluate(() => ({ height: document.documentElement.scrollHeight, boxes: Object.fromEntries([
    '.announcement-bar', '.header-inner', '.hero-banner', '.hero-title', '.hero-image', '.flash-section .section-heading-row', '#flash-products', '#flash-products .product-card', '#flash-products .product-image',
    '.category-grid', '.category-card', '.category-card .icon', '.best-selling-section .product-grid', '.promo-banner', '.promo-title', '#explore-grid', '#explore-grid .product-card', '.explore-section .section-action-row',
    '.arrival-grid', '.arrival-card', '.arrival-card > img', '.arrival-card-copy', '.services-grid', '.site-footer', '.footer-grid', '.footer-column'
  ].map(s => [s, [...document.querySelectorAll(s)].map(e => {
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, spacing: c.letterSpacing };
  })])) }));
}
async function swipe(page, id, direction) {
  await page.locator('#' + id).evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 180));
  const box = await page.locator('#' + id).boundingBox();
  const x1 = direction > 0 ? box.x + box.width - 24 : box.x + 24;
  const x2 = direction > 0 ? box.x + 24 : box.x + box.width - 24;
  const y = box.y + Math.min(80, box.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 12, y }] });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(650);
  await cdp.detach();
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    for (const width of [360, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      observe(page);
      await page.route('**/qa-missing.webp', r => r.abort('failed'));
      await load(page);
      const sizes = [];
      for (const count of [0, 1, 3, 11, 100]) {
        await inject(page, count);
        for (const id of ['flash-products', 'category-grid']) {
          const m = await walkArrows(page, id, count, width + '/' + id + '/' + count);
          sizes.push({ count, ...m });
        }
        await inject(page, count, true, true);
        for (const id of ['flash-products', 'category-grid']) {
          const m = await metrics(page, id);
          check(width + '/' + id + '/' + count + ': довгі назви/відсутні фото не створюють рядів чи скролу сторінки', m.rows <= 1 && m.pageScroll === m.pageClient, m);
        }
        if (count) check(width + '/flash/' + count + ': недоступні фото мають текстову заміну', await page.locator('#flash-products .image-fallback').evaluateAll(es => es.every(e => !e.hidden)));

        await page.evaluate(count => renderProductList('explore', Array.from({ length: count }, (_, i) => ({ ...exploreProducts[i % exploreProducts.length], id: 'catalog-' + i, name: 'Товар каталогу ' + i }))), count);
        await settle(page);
        const shown = () => page.locator('#explore-grid .product-card:not([hidden])').count();
        check(width + '/catalog/' + count + ': перша порція максимум 8', await shown() === Math.min(8, count));
        const more = page.locator('[data-load-more]');
        const increments = [];
        let before = await shown();
        while (!(await more.isDisabled())) {
          await more.click();
          const after = await shown();
          increments.push(after - before); before = after;
        }
        check(width + '/catalog/' + count + ': дозавантаження тільки по 8, остання порція решта', before === count && increments.every(n => n > 0 && n <= 8) && increments.slice(0, -1).every(n => n === 8), increments);
        check(width + '/catalog/' + count + ': після останньої порції кнопка disabled, стрілок немає', await more.isDisabled() && await page.locator('[data-scroll="explore-grid"]').count() === 0);
      }
      for (const id of ['flash-products', 'category-grid']) {
        const rows = sizes.filter(m => m.id === id && [3, 11, 100].includes(m.count));
        check(width + '/' + id + ': висота стрічки не росте від кількості карток', Math.max(...rows.map(m => m.height)) - Math.min(...rows.map(m => m.height)) <= 1, rows.map(m => ({ count: m.count, height: m.height })));
      }
      await page.evaluate(() => renderProductList('best', Array.from({ length: 100 }, (_, i) => ({ ...bestProducts[0], id: 'best-' + i }))));
      check(width + ': популярні — максимум 4, без стрілок', await page.locator('[data-product-list="best"] .product-card').count() === 4 && await page.locator('.best-selling-section [data-scroll]').count() === 0);
      matrix.push({ width, sizes });
      await page.close();
      console.log('Завершено viewport ' + width);
    }
    for (const width of [360, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      observe(page);
      await load(page);
      await inject(page, 11);
      for (const id of ['flash-products', 'category-grid']) {
        await swipe(page, id, 1);
        const after = await metrics(page, id);
        await swipe(page, id, -1);
        const back = await metrics(page, id);
        check(width + '/' + id + ': справжні touch-події гортання в обидва боки', after.left > 0 && back.left < after.left && back.pageScroll === back.pageClient, { after: after.left, back: back.left });
      }
      await page.close();
    }
    for (const width of [360, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      observe(page);
      await load(page);
      await require('./capture-sections.cjs')(page, width);
      const smart = await page.locator('#category-grid [title="Смартгодинники"]').evaluate(e => ({ text: e.textContent, client: e.clientWidth, scroll: e.scrollWidth, whiteSpace: getComputedStyle(e).whiteSpace }));
      check(width + ': Смартгодинники цілим словом, без обрізання', smart.whiteSpace === 'nowrap' && smart.scroll <= smart.client, smart);
      const cards = await page.locator('.arrival-card').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
      check(width + ': всі новинки однакової висоти 240', cards.every(h => h === 240), cards);
      check(width + ': аудіо й парфуми contain, фото всередині карток', await page.locator('.arrival-card-small > img').evaluateAll(es => es.every(e => {
        const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect();
        return getComputedStyle(e).objectFit === 'contain' && r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom;
      })));
      await page.close();
    }
    const current = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await load(current);
    const now = await desktopState(current);
    const oldCss = execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', 'safe.directory=' + repo.replace(/\\/g, '/'), 'show', '5ef6366:assets/css/style.css'], { cwd: repo, encoding: 'utf8' });
    const old = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await old.route('**/assets/css/style.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: oldCss }));
    await load(old);
    const before = await desktopState(old), desktopDifferences = [];
    for (const [selector, boxes] of Object.entries(before.boxes)) boxes.forEach((box, i) => {
      const b = now.boxes[selector][i];
      for (const key of ['x', 'y', 'w', 'h']) if (Math.abs(box[key] - b[key]) > 1) desktopDifferences.push({ selector, i, key, before: box[key], after: b[key] });
      for (const key of ['font', 'size', 'weight', 'lineHeight', 'spacing']) if (box[key] !== b[key]) desktopDifferences.push({ selector, i, key, before: box[key], after: b[key] });
    });
    check('1440: геометрія і типографіка збережені, висота 5902', !desktopDifferences.length && now.height === 5902, desktopDifferences);
    await current.close(); await old.close();
    check('Без неочікуваних JS/Console/Network помилок', errors.length === 0, errors);
    const report = { date: '2026-10-25', status: 'Очікує перегляду користувачки, крок 4 не фіналізовано', catalogChoice: 'Сітка, порції по 8, без стрілок', checks, matrix, desktopDifferences, errors, expectedImageFailures: expectedImageFailures.length,
      passed: checks.filter(c => c.passed).length, count: checks.length, browser: await browser.version(), scope: 'Edge та CDP touch-емуляція; не фізичні телефони та не повна матриця браузерів.' };
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, count: report.count, failed: checks.filter(c => !c.passed) }, null, 2));
    if (checks.some(c => !c.passed)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
