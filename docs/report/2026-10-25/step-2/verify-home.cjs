const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [], errors = [], externalRequests = [];
  function check(name, passed, details) { checks.push({ name, passed: !!passed, details }); }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push(r.url()));
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) externalRequests.push(r.url()); });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => ({
      cards: document.querySelectorAll('.product-card').length,
      categoryIcons: document.querySelectorAll('.category-card .icon').length,
      tools: [...document.querySelectorAll('.product-card')].map(c => c.querySelectorAll('.product-tool').length),
      starCounts: [...document.querySelectorAll('.rating-stars')].map(c => c.children.length),
      fits: [...document.querySelectorAll('.product-image')].map(i => getComputedStyle(i).objectFit),
      cameraColor: getComputedStyle(document.querySelector('[data-category-filter="camera"]')).backgroundColor,
      selectedCategories: document.querySelectorAll('[data-category-filter][aria-pressed="true"]').length,
      slide: [...document.querySelectorAll('.hero-dot')].findIndex(b => b.getAttribute('aria-current') === 'true')
    }));
    check('18 товарних карток', initial.cards === 18, initial.cards);
    check('6 іконок категорій', initial.categoryIcons === 6, initial.categoryIcons);
    check('Сердечко та око на кожній картці', initial.tools.every(n => n === 2), initial.tools);
    check('5 зірок кожного рейтингу з наявних SVG', initial.starCounts.every(n => n === 5), initial.starCounts);
    check('Фото товарів object-fit: contain', initial.fits.every(f => f === 'contain'), initial.fits);
    check('Камера початково світла, категорії не вибрані', initial.cameraColor === 'rgb(255, 255, 255)' && initial.selectedCategories === 0, initial);
    check('Початковий iPhone — третя позиція індикатора, як у PNG', initial.slide === 2, initial.slide);
    await page.locator('[data-category-filter="camera"]').hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-category-filter="camera"]')).backgroundColor === 'rgb(219, 68, 68)');
    const hovered = await page.evaluate(() => ({ color: getComputedStyle(document.querySelector('[data-category-filter="camera"]')).backgroundColor,
      selected: document.querySelectorAll('[data-category-filter][aria-pressed="true"]').length,
      visible: [...document.querySelectorAll('.product-card')].filter(c => !c.hidden).length }));
    check('Червоне наведення не вмикає фільтр', hovered.color === 'rgb(219, 68, 68)' && hovered.selected === 0 && hovered.visible === 18, hovered);
    const slides = [];
    for (let index = 0; index < 5; index++) {
      await page.locator('.hero-dot').nth(index).click();
      slides.push(await page.evaluate(() => {
        const banner = document.querySelector('.hero-banner').getBoundingClientRect();
        const title = document.querySelector('.hero-title').getBoundingClientRect();
        const link = document.querySelector('.hero-link').getBoundingClientRect();
        return { title: document.querySelector('h1').textContent, titleHeight: title.height,
          fits: title.bottom <= link.top && link.bottom <= banner.bottom,
          h1Count: document.querySelectorAll('h1').length };
      }));
    }
    check('Усі 5 слайдів вміщують заголовок і CTA на 1440 px', slides.every(s => s.fits && s.h1Count === 1), slides);
    await page.locator('#flash-products .product-card').first().locator('.product-tool').nth(1).click();
    check('Око картки показує toast', (await page.locator('.toast-message').last().textContent()) === 'Буде доступно на наступному етапі');
    await page.locator('#subscribe-email').fill('student@example.com');
    await page.locator('[data-subscribe] button').click();
    check('Підписка демонстраційна, без відправлення даних', (await page.locator('.toast-message').last().textContent()) === 'Буде доступно на наступному етапі');
    const layouts = JSON.parse(fs.readFileSync(path.join(__dirname, 'product-image-layout.json'), 'utf8'));
    const photos = await page.evaluate(layouts => [...document.querySelectorAll('.product-image')].map(img => {
      const name = img.getAttribute('src').split('/').pop().replace(/^product-/, '').replace(/\.webp$/, '');
      const data = layouts[name], ir = img.getBoundingClientRect(), mr = img.closest('.product-media').getBoundingClientRect();
      const [x0, y0, x1, y1] = data.alphaBounds, [w, h] = data.sourceSize;
      const painted = [ir.left + ir.width * x0 / w - mr.left, ir.top + ir.height * y0 / h - mr.top,
        ir.left + ir.width * x1 / w - mr.left, ir.top + ir.height * y1 / h - mr.top];
      return { name, painted, media: [mr.width, mr.height], fits: painted[0] >= -0.5 && painted[1] >= -0.5 && painted[2] <= mr.width + 0.5 && painted[3] <= mr.height + 0.5 };
    }), layouts);
    check('Непрозорі частини всіх товарних фото всередині медіа', photos.every(p => p.fits), photos);
    check('Без зовнішніх мережевих запитів', externalRequests.length === 0, externalRequests);
    check('Без помилок JavaScript та збоїв запитів', errors.length === 0, errors);
    const report = { date: '2026-10-25', browser: 'Microsoft Edge / Playwright headless', width: 1440,
      scope: 'Крок 2: desktop та коротка перевірка змінених компонентів. Не є повним кроком 4, W3C/Jigsaw або мобільним прийманням.',
      checks, passed: checks.filter(c => c.passed).length, count: checks.length };
    fs.writeFileSync(path.join(__dirname, 'component-checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, count: report.count, failures: checks.filter(c => !c.passed) }, null, 2));
    if (report.passed !== report.count) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
