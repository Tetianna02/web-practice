const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const checks = [], errors = [];
const check = (name, passed, details) => checks.push({ name, passed: !!passed, details });
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
 try {
  for (const width of [360, 768, 1024, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
   page.on('pageerror', e => errors.push(e.message));
   await page.route('**/qa-missing-catalog.webp', r => r.abort('failed'));
   await page.goto('http://127.0.0.1:4173/web-practice/', { waitUntil: 'networkidle' });
   await page.evaluate(() => renderProductList('explore', Array.from({ length: 100 }, (_, i) => ({ ...exploreProducts[0], id: 'stress-' + i,
    category: i < 50 ? 'computers' : 'home', name: (i < 50 ? 'ПершаДовгаНазваБезПробілів' : 'ДругаДовгаНазваБезПробілів').repeat(20), image: 'qa-missing-catalog.webp' }))));
   await page.locator('#explore-grid img').evaluateAll(es => es.forEach(e => { e.loading = 'eager'; }));
   await page.waitForFunction(() => [...document.querySelectorAll('#explore-grid img')].every(e => e.hidden));
   check(width + ': каталог 100 довгих назв і відсутніх фото — лише 8 видимих, без горизонтального скролу', await page.evaluate(() => document.querySelectorAll('#explore-grid .product-card:not([hidden])').length === 8 && document.documentElement.scrollWidth === document.documentElement.clientWidth));
   await page.locator('[data-load-more]').click();
   check(width + ': додано саме 8, разом 16', await page.locator('#explore-grid .product-card:not([hidden])').count() === 16);
   await page.evaluate(() => { const form = document.querySelector('.search-form'); form.querySelector('input').value = 'Друга'; form.requestSubmit(); });
   check(width + ': новий пошук скидає ліміт до 8 відповідних товарів', await page.locator('#explore-grid .product-card:not([hidden])').count() === 8 && await page.locator('#explore-grid .product-card:not([hidden])').evaluateAll(es => es.every(e => e.dataset.productName.includes('друга'))));
   await page.evaluate(() => selectCategory('computers'));
   check(width + ': нуль збігів — кнопка disabled', await page.locator('#explore-grid .product-card:not([hidden])').count() === 0 && await page.locator('[data-load-more]').isDisabled());
   await page.evaluate(() => { const form = document.querySelector('.search-form'); form.querySelector('input').value = ''; form.requestSubmit(); });
   check(width + ': очищення пошуку зберігає категорію, показує перші 8', await page.locator('#explore-grid .product-card:not([hidden])').count() === 8 && await page.locator('#explore-grid .product-card:not([hidden])').evaluateAll(es => es.every(e => e.dataset.category === 'computers')));
   for (const id of ['flash-products', 'category-grid']) {
    await page.evaluate(id => {
     activeCategory = null; activeQuery = ''; updateProductVisibility();
     if (id === 'category-grid') document.getElementById(id).replaceChildren(...Array.from({ length: 11 }, (_, i) => createCategoryButton(categories[i % categories.length], 'category-card')));
    }, id);
    const next = page.locator('[data-scroll="' + id + '"][data-direction="1"]');
    await page.waitForTimeout(80);
    await next.focus();
    await page.keyboard.press('Tab');
    check(width + '/' + id + ': Tab переводить фокус зі стрілки у стрічку', await page.locator('#' + id).evaluate(e => e === document.activeElement));
    await next.click();
    await page.waitForTimeout(700);
    check(width + '/' + id + ': плавне гортання працює без reduced-motion', await page.locator('#' + id).evaluate(e => e.scrollLeft > 0));
    await page.locator('#' + id).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(id => document.querySelector('[data-scroll="' + id + '"][data-direction="1"]').disabled, id);
    await page.keyboard.press('Home');
    await page.waitForFunction(id => document.querySelector('[data-scroll="' + id + '"][data-direction="-1"]').disabled, id);
    check(width + '/' + id + ': плавні End/Home завершуються на краях', await page.locator('#' + id).evaluate(e => e.scrollLeft <= 2));
   }
   await page.close();
  }
  check('Немає помилок JavaScript', errors.length === 0, errors);
  fs.writeFileSync(path.join(__dirname, 'filter-motion-checks.json'), JSON.stringify({ date: '2026-10-25', checks, passed: checks.filter(c => c.passed).length, count: checks.length }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, count: checks.length, failed: checks.filter(c => !c.passed) }, null, 2));
  if (checks.some(c => !c.passed)) process.exitCode = 1;
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
