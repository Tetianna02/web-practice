const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:4173/web-practice/';
const checks = [], errors = [], normal = [], long = [], desktopDifferences = [];
const check = (name, passed, details) => checks.push({ name, passed: !!passed, details });
const settle = p => p.waitForTimeout(60);
function observe(p) {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('requestfailed', r => errors.push(r.url()));
  p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
}
async function load(p) {
 await p.goto(base, { waitUntil: 'networkidle' });
 await p.evaluate(() => document.fonts.ready);
 await p.locator('.promo-image-wrap img').evaluate(async e => { e.loading = 'eager'; await e.decode(); });
}
async function snapshot(p) {
 return p.evaluate(() => ({ width: innerWidth, height: document.documentElement.scrollHeight, boxes: Object.fromEntries([
  '.promo-section', '.promo-banner', '.promo-content', '.promo-kicker', '.promo-title', '.promo-banner .countdown-wrap', '.countdown-circles', '.countdown-circle', '.promo-button', '.promo-image-wrap', '.promo-image-wrap img'
 ].map(s => [s, [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height,
  font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, textAlign: c.textAlign, justify: c.justifyContent }; })])) }));
}
async function jblMetrics(p) {
 return p.evaluate(() => {
  const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, center: (r.left + r.right) / 2 }; };
  const banner = box('.promo-banner'), content = box('.promo-content'), picture = box('.promo-image-wrap'), image = box('.promo-image-wrap img'), button = box('.promo-button');
  const circles = [...document.querySelectorAll('.countdown-circle')].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  return { viewport: innerWidth, banner, content, picture, image, button, timer: box('.countdown-circles'),
   subject: { left: image.x + image.w * 218 / 1605, right: image.x + image.w * 1384 / 1605, top: image.y + image.h * 511 / 1605, bottom: image.y + image.h * 1178 / 1605 },
   circles, textAlign: getComputedStyle(document.querySelector('.promo-content')).textAlign,
   titleFits: document.querySelector('.promo-title').scrollHeight <= document.querySelector('.promo-title').clientHeight + 1,
   titleHeight: document.querySelector('.promo-title').getBoundingClientRect().height,
   titleLineHeight: parseFloat(getComputedStyle(document.querySelector('.promo-title')).lineHeight),
   pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth };
 });
}
async function capture(p, selector, filename) {
 await p.locator('img').evaluateAll(async es => { es.forEach(e => { e.loading = 'eager'; }); await Promise.all(es.map(e => e.decode().catch(() => {}))); });
 for (let y = 0; y < await p.evaluate(() => document.documentElement.scrollHeight); y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40); }
 await p.waitForLoadState('networkidle'); await p.evaluate(() => scrollTo(0, 0)); await settle(p);
 const rect = await p.locator(selector).boundingBox();
 await p.screenshot({ path: path.join(__dirname, filename), fullPage: true, clip: rect, animations: 'disabled' });
}
async function arrows(p) {
 return p.evaluate(() => {
  const e = document.getElementById('explore-grid'), buttons = [...document.querySelectorAll('[data-scroll="explore-grid"]')];
  const title = document.querySelector('.explore-section .section-title').getBoundingClientRect();
  return { max: Math.max(0, e.scrollWidth - e.clientWidth), left: e.scrollLeft, visible: buttons.every(b => !b.hidden && !b.parentElement.hidden),
   previous: buttons[0].disabled, next: buttons[1].disabled,
   styles: buttons.map(b => { const c = getComputedStyle(b), r = b.getBoundingClientRect(); return { w: r.width, h: r.height, color: c.backgroundColor, radius: c.borderRadius, opacity: c.opacity, gap: getComputedStyle(b.parentElement).gap, centerY: r.y + r.height / 2 }; }),
   flash: (() => { const b = document.querySelector('[data-scroll="flash-products"]'), c = getComputedStyle(b), r = b.getBoundingClientRect(); return { w: r.width, h: r.height, color: c.backgroundColor, radius: c.borderRadius, gap: getComputedStyle(b.parentElement).gap }; })(),
   titleCenterY: title.y + title.height / 2, pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth };
 });
}
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
 try {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'desktop-before.json'), 'utf8'));
  for (const width of [360, 480, 640, 768, 900, 1023, 1024, 1440]) {
   const p = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); observe(p); await load(p);
   const m = await jblMetrics(p); normal.push(m);
   check(width + ': немає горизонтального скролу документа', m.pageWidth === m.pageScroll);
   check(width + ': колонка ціла в межах банера', m.subject.left >= m.banner.x - 1 && m.subject.right <= m.banner.right + 1 && m.subject.top >= m.banner.y - 1 && m.subject.bottom <= m.banner.bottom + 1, m);
   if (width < 1024) {
    check(width + ': спільна центральна вісь заголовка, підпису, таймера, кнопки й фото', m.textAlign === 'center' && [m.content, m.timer, m.button, m.picture].every(r => Math.abs(r.center - m.banner.center) <= 1), m);
    check(width + ': чотири круглі таймери одним рядком', m.circles.every(c => Math.abs(c.y - m.circles[0].y) <= 1 && Math.abs(c.w - c.h) <= 1));
    check(width + ': проміжок між кнопкою й видимим фото 16 px', Math.abs(m.subject.top - m.button.bottom - 16) <= 1, { gap: m.subject.top - m.button.bottom });
   } else {
    const current = await snapshot(p), old = baseline.find(x => x.width === width);
    for (const [selector, boxes] of Object.entries(old.boxes)) boxes.forEach((a, i) => { const b = current.boxes[selector][i];
     for (const k of ['x', 'y', 'w', 'h']) if (Math.abs(a[k] - b[k]) > 1) desktopDifferences.push({ width, selector, i, k, before: a[k], after: b[k] });
     for (const k of ['font', 'size', 'weight', 'lineHeight', 'textAlign', 'justify']) if (a[k] !== b[k]) desktopDifferences.push({ width, selector, i, k, before: a[k], after: b[k] });
    });
    check(width + ': нормальний JBL та висота документа збережені', !desktopDifferences.some(d => d.width === width) && old.height === current.height, desktopDifferences.filter(d => d.width === width));
   }
   await p.locator('.promo-title').evaluate(e => { e.textContent = 'Більше музики для кожного дня: обирайте улюблені пісні та слухайте їх разом із друзями. '.repeat(3) + 'НадзвичайноДовгийЗаголовокБезПробілів'.repeat(3); });
   const l = await jblMetrics(p); long.push(l);
   check(width + ': довгий заголовок без скролу, кнопка й фото не перекриваються', l.pageWidth === l.pageScroll && (width >= 1024 || l.picture.y >= l.button.bottom + 15), l);
   if (width < 1024) check(width + ': довгий заголовок видимий повністю, вирівнювання збережене', l.titleFits && l.textAlign === 'center' && [l.timer, l.button, l.picture].every(r => Math.abs(r.center - l.banner.center) <= 1));
   else check(width + ': довгий desktop-заголовок до трьох рядків, кнопка не обрізана', l.titleHeight <= l.titleLineHeight * 3 + 1 && l.button.bottom <= l.banner.bottom + 1, l);
   if (width === 768 || width === 1440) await capture(p, '.promo-banner', 'jbl-long-' + width + '.png');
   await p.close();
  }
  for (const width of [360, 768, 1024, 1440]) {
   const p = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); observe(p); await load(p);
   for (const count of [0, 1, 8, 11, 100]) {
    await p.evaluate(n => renderProductList('explore', Array.from({ length: n }, (_, i) => ({ ...exploreProducts[i % 8], id: 'qa-' + i }))), count); await settle(p);
    let m = await arrows(p);
    check(width + '/' + count + ': правило видимості й disabled', m.max > 2 ? m.visible && m.previous && !m.next : (width >= 1024 ? m.visible : !m.visible) && m.previous && m.next, m);
    if (width >= 1024) {
     check(width + '/' + count + ': стиль, розмір і проміжок як у розпродажі', m.styles.every(s => ['w', 'h', 'color', 'radius', 'gap'].every(k => s[k] === m.flash[k])) && Math.abs(m.styles[0].centerY - m.titleCenterY) <= 4, m);
     if (m.max <= 2) check(width + '/' + count + ': дві видимі бліді disabled-кнопки', m.styles.every(s => Number(s.opacity) === 0.35));
    }
    if (m.max > 2) {
     await p.locator('#explore-grid').focus(); await p.keyboard.press('End'); await settle(p); m = await arrows(p);
     check(width + '/' + count + ': у кінці наступна disabled, обидві видимі', m.visible && m.next && !m.previous && m.left >= m.max - 2);
     await p.keyboard.press('Home'); await settle(p); m = await arrows(p);
     check(width + '/' + count + ': на початку попередня disabled', m.previous && !m.next && m.left <= 2);
    }
    check(width + '/' + count + ': документ не розширено', m.pageWidth === m.pageScroll);
   }
   await p.close();
  }
  const resize = await browser.newPage({ viewport: { width: 1024, height: 900 }, reducedMotion: 'reduce' }); observe(resize); await load(resize);
  await resize.evaluate(() => renderProductList('explore', [exploreProducts[0]])); await settle(resize);
  const r1 = await arrows(resize); await resize.setViewportSize({ width: 1023, height: 900 }); await settle(resize); const r2 = await arrows(resize);
  await resize.setViewportSize({ width: 1440, height: 900 }); await settle(resize); const r3 = await arrows(resize);
  check('Resize через 1024: видимі disabled / приховані / видимі disabled', r1.visible && r1.previous && r1.next && !r2.visible && r3.visible && r3.previous && r3.next);
  await resize.close();
  for (const width of [360, 768, 1023, 1440]) {
   const p = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 1024, hasTouch: width < 1024, reducedMotion: 'reduce', deviceScaleFactor: 1 }); observe(p); await load(p);
   await capture(p, width === 1440 ? '.explore-section' : '.promo-banner', (width === 1440 ? 'catalog-' : 'jbl-') + width + '.png'); await p.close();
  }
  check('Немає помилок JS/Console/Network', errors.length === 0, errors);
  const report = { date: '2026-10-25', status: 'Очікує перегляду: крок 4 не фіналізовано', checks, normal, long, desktopDifferences, errors,
   passed: checks.filter(c => c.passed).length, count: checks.length, browser: await browser.version(), scope: 'Edge, viewport і touch-емуляція; без фізичних телефонів та Safari.' };
  fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, count: report.count, failed: checks.filter(c => !c.passed) }, null, 2));
  if (checks.some(c => !c.passed)) process.exitCode = 1;
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
