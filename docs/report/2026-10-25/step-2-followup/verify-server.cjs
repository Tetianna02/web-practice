const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const folder = __dirname;
const repo = path.resolve(folder, '../../../..');
const beforeCss = execFileSync(process.env.GIT_EXECUTABLE || 'git',
  ['-c', 'safe.directory=' + repo.replace(/\\/g, '/'), 'show', 'HEAD:assets/css/style.css'],
  { cwd: repo, encoding: 'utf8' });
const afterCss = fs.readFileSync(path.join(repo, 'assets/css/style.css'), 'utf8');
const fontDeclarations = css => css.match(/^\s*(?:font(?:-family|-size|-weight|-style|-display)?|line-height|letter-spacing|unicode-range)\s*:[^;]+;/gm)
  .map(line => line.trim());

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const cases = [];
  try {
    for (const [name, base] of [
      ['local', 'http://127.0.0.1:8000/'],
      ['pages-prefix', 'http://127.0.0.1:4173/web-practice/']
    ]) {
      for (const width of [1440, 1920]) {
        for (const forcedScrollbar of [false, true]) {
          const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
          const errors = [], requests = [], responses = [];
          page.on('pageerror', e => errors.push(e.message));
          page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
          page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
          page.on('request', r => requests.push(r.url()));
          page.on('response', r => { responses.push({ url: r.url(), status: r.status() }); if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
          await page.goto(base, { waitUntil: 'networkidle' });
          if (forcedScrollbar) await page.addStyleTag({ content: 'html { overflow-y: scroll; } ::-webkit-scrollbar { width: 17px; height: 17px; }' });
          await page.evaluate(async () => {
            await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(w + ' 16px Poppins', 'Exclusive')));
            await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(w + ' 16px Inter', 'Україна Ґґ Єє Іі Її')));
            await document.fonts.ready;
          });
          for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 800) {
            await page.evaluate(y => window.scrollTo(0, y), y);
            await page.waitForTimeout(60);
          }
          await page.waitForLoadState('networkidle');
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(80);
          const details = await page.evaluate(async () => {
            const root = document.documentElement, rail = document.querySelector('.horizontal-product-list');
            const spriteUrl = new URL('assets/images/icons/sprite.svg', location.href).href;
            const spriteResponse = await fetch(spriteUrl);
            const sprite = new DOMParser().parseFromString(await spriteResponse.text(), 'image/svg+xml');
            const missingSymbols = [...document.querySelectorAll('svg use')].map(u => u.getAttribute('href')).filter(h => !sprite.getElementById(h.split('#')[1]));
            const unclippedOffenders = [...document.querySelectorAll('body *')].filter(el => {
              const r = el.getBoundingClientRect();
              if (!r.width || (r.left >= -0.5 && r.right <= root.clientWidth + 0.5)) return false;
              const ownStyle = getComputedStyle(el);
              if (ownStyle.clip !== 'auto' || ownStyle.clipPath !== 'none') return false;
              for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false;
              }
              return true;
            }).map(el => ({ tag: el.tagName, class: String(el.className), right: el.getBoundingClientRect().right }));
            const sampleSelectors = ['.hero-title', '.section-title', '.product-name', '.product-price-current', '.navigation-link', '.primary-button'];
            return {
              innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
              scrollbarWidth: innerWidth - root.clientWidth, pageHeight: root.scrollHeight,
              overflow: root.scrollWidth > root.clientWidth,
              rail: { right: rail.getBoundingClientRect().right, width: rail.clientWidth, scrollWidth: rail.scrollWidth,
                containerType: getComputedStyle(document.querySelector('.flash-section')).containerType },
              unclippedOffenders, spriteStatus: spriteResponse.status, missingSymbols,
              brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
              fonts: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })),
              typography: Object.fromEntries(sampleSelectors.map(selector => { const s = getComputedStyle(document.querySelector(selector));
                return [selector, { family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing }]; }))
            };
          });
          await page.evaluate(() => window.scrollTo(9999, 0));
          details.horizontalScrollAfterAttempt = await page.evaluate(() => scrollX);
          await page.locator('.horizontal-product-list').evaluate(el => { el.scrollLeft = 200; });
          details.internalRailScrolls = await page.locator('.horizontal-product-list').evaluate(el => el.scrollLeft > 0);
          await page.locator('.horizontal-product-list').evaluate(el => { el.scrollLeft = 0; });
          const wrongPrefix = requests.filter(url => !url.startsWith(base));
          const label = name + '-' + width + (forcedScrollbar ? '-scrollbar-17' : '');
          if (!forcedScrollbar) await page.screenshot({ path: path.join(folder, label + '.png'), fullPage: true, animations: 'disabled' });
          if (name === 'pages-prefix' && width === 1440 && !forcedScrollbar) {
            const samples = [
              ['category-phone', '.category-card .icon', 0], ['category-computer', '.category-card .icon', 1],
              ['category-watch', '.category-card .icon', 2], ['category-camera', '.category-card .icon', 3],
              ['category-headphones', '.category-card .icon', 4], ['category-gaming', '.category-card .icon', 5],
              ['heart', '.product-tool .icon', 0], ['eye', '.product-tool .icon', 1],
              ['stars', '.rating-stars', 0], ['arrow-left', '.round-button .icon', 0], ['arrow-right', '.round-button .icon', 1]
            ];
            for (const [label, selector, index] of samples) {
              await page.locator(selector).nth(index).screenshot({ path: path.join(folder, 'icon-' + label + '.png'), animations: 'disabled' });
            }
          }
          cases.push({ label, base, width, forcedScrollbar, ...details, wrongPrefix, errors,
            successfulResources: responses.filter(r => r.url.includes('/assets/')),
            passed: !details.overflow && details.horizontalScrollAfterAttempt === 0 && details.internalRailScrolls &&
              details.unclippedOffenders.length === 0 && details.spriteStatus === 200 && details.missingSymbols.length === 0 &&
              details.brokenImages.length === 0 && details.fonts.every(f => f.status === 'loaded') && !errors.length && !wrongPrefix.length });
          console.log(JSON.stringify({ label, clientWidth: details.clientWidth, scrollWidth: details.scrollWidth,
            pageHeight: details.pageHeight, railRight: details.rail.right, overflow: details.overflow, errors, wrongPrefix }));
          await page.close();
        }
      }
    }
  } finally { await browser.close(); }
  const fontsUnchanged = JSON.stringify(fontDeclarations(beforeCss)) === JSON.stringify(fontDeclarations(afterCss));
  const report = { date: '2026-10-25', fontsUnchanged, fontDeclarationCount: fontDeclarations(afterCss).length,
    ps5DeferredByUser: true, cases, passed: fontsUnchanged && cases.every(c => c.passed),
    scope: 'Локальний сервер та імітація шляху /web-practice/, не реальна публікація GitHub Pages. Крок 3 не виконаний.' };
  fs.writeFileSync(path.join(folder, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, fontsUnchanged, casesPassed: cases.filter(c => c.passed).length, count: cases.length }));
  if (!report.passed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
