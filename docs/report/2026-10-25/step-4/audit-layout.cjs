const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:4173/web-practice/';
const out = path.join(__dirname, process.argv[2] || 'before');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const results = [];
  try {
    for (const width of [320, 360, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 800) {
        await page.evaluate(y => scrollTo(0, y), y);
        await page.waitForTimeout(40);
      }
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => scrollTo(0, 0));
      const audit = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        return { clientWidth: w, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
          overflowing: [...document.querySelectorAll('body *')].filter(e => {
            if (e.closest('.scroll-rail') || !e.getClientRects().length) return false;
            const r = e.getBoundingClientRect();
            return r.left < -1 || r.right > w + 1;
          }).map(e => ({ tag: e.tagName, class: e.className?.baseVal ?? e.className, text: e.textContent.slice(0, 50), left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right })) };
      });
      results.push({ width, ...audit });
      await page.screenshot({ path: path.join(out, 'home-' + width + '.png'), fullPage: true });
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'layout.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
