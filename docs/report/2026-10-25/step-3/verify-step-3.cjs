const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../..');
const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(repo, 'assets/css/style.css'), 'utf8');
const js = fs.readFileSync(path.join(repo, 'assets/js/main.js'), 'utf8');
const git = args => execFileSync(process.env.GIT_EXECUTABLE || 'git',
  ['-c', 'safe.directory=' + repo.replace(/\\/g, '/'), ...args], { cwd: repo, encoding: 'utf8' });
const fontProperties = s => s.match(/^\s*(?:font(?:-family|-size|-weight|-style|-display)?|line-height|letter-spacing|unicode-range)\s*:[^;]+;/gm).map(v => v.trim());
const checks = [], errors = [], nonGetRequests = [], dialogs = [], assets = new Map();
const base = 'http://127.0.0.1:4173/web-practice/';
const message = 'Буде доступно на наступному етапі';
function check(name, passed, details) { checks.push({ name, passed: !!passed, details }); }
function observe(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
  page.on('request', r => { if (r.method() !== 'GET') nonGetRequests.push(r.method() + ' ' + r.url()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); if (r.url().includes('/assets/')) assets.set(r.url(), r.status()); });
  page.on('dialog', async d => { dialogs.push(d.type()); await d.dismiss(); });
}
async function timers(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-countdown]')].map(root => {
    const values = ['days', 'hours', 'minutes', 'seconds'].map(p => Number(root.querySelector('[data-countdown-' + p + ']').textContent));
    return { name: root.dataset.countdown, end: root.dataset.countdownEnd, values,
      seconds: values[0] * 86400 + values[1] * 3600 + values[2] * 60 + values[3],
      timerHidden: root.querySelector('.countdown').hidden,
      messageHidden: root.querySelector('[data-countdown-expired]').hidden,
      message: root.querySelector('[data-countdown-expired]').textContent };
  }));
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    observe(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 800) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(60);
    }
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));
    const audit = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')];
      const mainHeadings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')].map(h => ({ level: Number(h.tagName[1]), text: h.textContent.trim() }));
      return {
        doctype: document.doctype?.name, lang: document.documentElement.lang,
        headStart: [...document.head.children].slice(0, 2).map(e => e.outerHTML),
        title: document.title, description: document.querySelector('meta[name="description"]').content,
        h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()), mainHeadings,
        missingAlt: [...document.images].filter(i => !i.getAttribute('alt')?.trim()).map(i => i.src),
        brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
        inputs: inputs.map(i => ({ id: i.id, type: i.getAttribute('type'), labels: [...i.labels].map(l => l.textContent.trim()) })),
        brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.getAttribute('href').slice(1))).map(a => a.outerHTML),
        styleTags: document.querySelectorAll('style').length,
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(e => ({ href: e.getAttribute('href'), inHead: !!e.closest('head') })),
        scripts: [...document.scripts].map(s => ({ src: s.getAttribute('src'), defer: s.defer })),
        favicon: new URL(document.querySelector('link[rel="icon"]').getAttribute('href'), location.href).href,
        spriteUseCount: document.querySelectorAll('svg use').length,
        cssSprites: [...document.querySelectorAll('.service-sprite')].map(e => { const s = getComputedStyle(e); return { class: e.className, width: s.width, height: s.height, image: s.backgroundImage, size: s.backgroundSize, position: s.backgroundPosition }; }),
        width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      };
    });
    check('DOCTYPE html', audit.doctype === 'html' && /^<!DOCTYPE html>/i.test(html));
    check('Charset і Viewport першими у head', /charset="UTF-8"/i.test(audit.headStart[0]) && /name="viewport"/.test(audit.headStart[1]), audit.headStart);
    check('Title змістовний і до 65 символів', audit.title.length > 0 && audit.title.length <= 65, { text: audit.title, length: audit.title.length });
    check('Description змістовний і до 160 символів', audit.description.length > 0 && audit.description.length <= 160, { text: audit.description, length: audit.description.length });
    check('lang=uk', audit.lang === 'uk');
    check('Один змістовний h1', audit.h1.length === 1 && audit.h1[0].length > 0, audit.h1);
    check('Ієрархія main без пропуску рівнів', audit.mainHeadings.every((h, i, all) => !i || h.level <= all[i - 1].level + 1), audit.mainHeadings);
    check('Усі img з alt і без збоїв завантаження', !audit.missingAlt.length && !audit.brokenImages.length, { missingAlt: audit.missingAlt, brokenImages: audit.brokenImages });
    check('Усі input мають label і явний type', audit.inputs.every(i => i.type && i.labels.length && i.labels.every(Boolean)), audit.inputs);
    check('CSS у head, зовнішній JS із defer', audit.stylesheets.every(s => s.inHead) && audit.scripts.every(s => s.src && s.defer), { css: audit.stylesheets, js: audit.scripts });
    check('Без style-тегів', audit.styleTags === 0);
    check('Внутрішні посилання мають цілі', audit.brokenAnchors.length === 0, audit.brokenAnchors);
    check('Без alert, відлагодження та маркерів конфлікту', !/\balert\s*\(|\bdebugger\b|console\.(log|debug)|<<<<<<<|=======|>>>>>>>/.test(js + html + css));
    check('Без Google Fonts та старого відліку localStorage', !/fonts\.googleapis|fonts\.gstatic|localStorage|getSaleEnd|flashDuration|jblDuration/.test(html + css + js));
    check('Типографіка не змінена', JSON.stringify(fontProperties(css)) === JSON.stringify(fontProperties(git(['show', 'HEAD:assets/css/style.css']))));
    check('Наявний SVG Sprite не змінений', fs.readFileSync(path.join(repo, 'assets/images/icons/sprite.svg'), 'utf8').replace(/\r\n/g, '\n') === git(['show', 'HEAD:assets/images/icons/sprite.svg']).replace(/\r\n/g, '\n'));
    check('CSS Sprite: 3 фрагменти одного атласу', audit.cssSprites.length === 3 && audit.cssSprites.every(s => s.image.includes('service-icons-css-sprite.svg') && s.width === '40px' && s.height === '40px') && audit.cssSprites.map(s => s.position).join('|') === '0px 0px|50% 0px|100% 0px', audit.cssSprites);
    check('SVG use залишився для решти іконок', audit.spriteUseCount > 0, audit.spriteUseCount);
    check('Desktop без горизонтального переповнення, висота 5902', audit.scrollWidth === audit.clientWidth && audit.height === 5902, { width: audit.width, clientWidth: audit.clientWidth, scrollWidth: audit.scrollWidth, height: audit.height });
    const favicon = await page.request.get(audit.favicon);
    check('Favicon доступний через префікс Pages', favicon.status() === 200, { url: audit.favicon, status: favicon.status() });
    await page.screenshot({ path: path.join(__dirname, 'home-1440.png'), fullPage: true, animations: 'disabled' });
    await page.locator('.services-section').screenshot({ path: path.join(__dirname, 'services-css-sprite.png'), animations: 'disabled' });
    for (const [index, name] of ['delivery', 'support', 'shield'].entries()) {
      await page.locator('.service-sprite').nth(index).screenshot({ path: path.join(__dirname, 'css-sprite-' + name + '.png'), animations: 'disabled' });
    }
    const stubSelectors = ['.desktop-navigation button[data-coming-soon]', '.cart-button', '.favorite-button',
      '.footer-column button[data-coming-soon]', '.product-tool', '.product-add-button'];
    const stubResults = [];
    for (const selector of stubSelectors) {
      const buttons = page.locator(selector);
      const count = selector === '.desktop-navigation button[data-coming-soon]' ? await buttons.count() : 1;
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        if (selector === '.product-add-button') await page.locator('.product-card').first().hover();
        await button.click();
        stubResults.push({ selector, index: i, text: await page.locator('.toast-message').last().textContent(), url: page.url() });
      }
    }
    check('Кошик, обране, відсутні сторінки й товарні дії дають toast', stubResults.every(r => r.text === message && r.url === base), stubResults);
    await page.screenshot({ path: path.join(__dirname, 'coming-soon-toast.png'), animations: 'disabled' });
    await page.locator('.desktop-navigation [data-open-auth]').click();
    check('Кнопка Вхід відкриває режим входу', await page.locator('[data-auth-mode="login"]').getAttribute('aria-selected') === 'true');
    await page.locator('.form-submit').click();
    check('Порожні email/пароль відхиляються', await page.locator('#auth-email').getAttribute('aria-invalid') === 'true' && await page.locator('#auth-password').getAttribute('aria-invalid') === 'true');
    await page.locator('#auth-email').fill('student@example.com');
    await page.locator('#auth-password').fill('demoPass123');
    await page.locator('.form-submit').click();
    check('Валідна демонстраційна форма повідомляє про наступний етап', (await page.locator('[data-form-status]').textContent()).includes('Дані перевірено') && await page.locator('.toast-message').last().textContent() === message);
    await page.locator('[data-auth-mode="register"]').click();
    await page.locator('#auth-name').fill('Демо');
    await page.locator('#auth-confirm-password').fill('different');
    await page.locator('.form-submit').click();
    check('Реєстрація перевіряє підтвердження й згоду', await page.locator('#auth-confirm-password').getAttribute('aria-invalid') === 'true' && await page.locator('#auth-consent').getAttribute('aria-invalid') === 'true');
    await page.locator('#auth-confirm-password').fill('demoPass123');
    await page.locator('#auth-consent').check();
    await page.locator('.form-submit').click();
    check('Валідна реєстрація не вдає створення акаунта', (await page.locator('[data-form-status]').textContent()).includes('Реєстрацію буде підключено'));
    await page.locator('.auth-dialog').evaluate(e => e.close());
    await page.close();

    async function frozenPage(now, timezoneId = 'Europe/Kiev', oldStorage = false) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId });
      observe(p);
      await p.clock.install({ time: new Date(now - 60000) });
      await p.clock.pauseAt(new Date(now));
      if (oldStorage) await p.addInitScript(() => {
        localStorage.setItem('exclusive:flash-sale-end', '1');
        localStorage.setItem('exclusive:jbl-sale-end', '9999999999999');
      });
      await p.goto(base, { waitUntil: 'networkidle' });
      return p;
    }
    const now = Date.parse('2026-10-25T12:00:00+02:00');
    const frozen = await frozenPage(now, 'Europe/Kiev', true);
    const first = await timers(frozen);
    check('Фіксовані строки не залежать від старого localStorage', first.every(t => t.seconds === Math.ceil((Date.parse(t.end) - now) / 1000) && !t.timerHidden), first);
    await frozen.reload({ waitUntil: 'networkidle' });
    const reloaded = await timers(frozen);
    check('Перезавантаження не перезапускає відлік', JSON.stringify(first) === JSON.stringify(reloaded), reloaded);
    await frozen.close();
    const otherZone = await frozenPage(now, 'America/New_York');
    const otherTimers = await timers(otherZone);
    check('Інший часовий пояс дає ті самі залишки', JSON.stringify(first) === JSON.stringify(otherTimers), otherTimers);
    await otherZone.close();
    const flashEnd = Date.parse('2026-11-30T23:59:59+02:00');
    const boundary = await frozenPage(flashEnd - 1000);
    check('За секунду до завершення показано 00:00:00:01', (await timers(boundary))[0].seconds === 1);
    await boundary.clock.runFor(1000);
    const ended = await timers(boundary);
    check('На межі строку розпродаж завершено, JBL ще активний', ended[0].timerHidden && !ended[0].messageHidden && ended[0].message === 'Акцію завершено' && !ended[1].timerHidden, ended);
    await boundary.locator('.flash-section').screenshot({ path: path.join(__dirname, 'flash-expired.png'), animations: 'disabled' });
    await boundary.reload({ waitUntil: 'networkidle' });
    check('Завершена акція після reload не оживає', (await timers(boundary))[0].timerHidden);
    await boundary.close();
    const bothEnded = await frozenPage(Date.parse('2027-01-01T00:00:00+02:00'));
    const finished = await timers(bothEnded);
    check('Після обох строків немає від’ємних значень', finished.every(t => t.timerHidden && !t.messageHidden && t.values.every(v => v === 0)), finished);
    await bothEnded.close();
    const invalid = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    observe(invalid);
    await invalid.route(base, route => route.fulfill({ status: 200, contentType: 'text/html', body: html.replace('2026-11-30T23:59:59+02:00', 'invalid-date') }));
    await invalid.goto(base, { waitUntil: 'networkidle' });
    const invalidTimer = (await timers(invalid))[0];
    check('Некоректна дата обробляється без збою JavaScript', invalidTimer.timerHidden && !invalidTimer.messageHidden && invalidTimer.message === 'Таймер тимчасово недоступний.', invalidTimer);
    await invalid.close();
    check('Форми не робили POST/інших змінних запитів', nonGetRequests.length === 0, nonGetRequests);
    check('Не було alert або інших JS-діалогів', dialogs.length === 0, dialogs);
    check('Без JS/console/мережевих помилок', errors.length === 0, errors);
    check('Новий CSS Sprite успішно завантажений через /web-practice/', [...assets].some(([url, status]) => url.endsWith('/assets/images/icons/service-icons-css-sprite.svg') && status === 200));
    const result = { date: '2026-10-25', step: 3, width: 1440, base, audit, checks,
      passed: checks.filter(c => c.passed).length, count: checks.length, resources: [...assets],
      scope: 'Локальна перевірка кроку 3 у Microsoft Edge. Мобільні екрани, повне приймання модального вікна, W3C/Jigsaw та публікація не виконувалися.' };
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ passed: result.passed, count: result.count, failed: checks.filter(c => !c.passed) }, null, 2));
    if (result.passed !== result.count) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
