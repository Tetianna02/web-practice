const path = require('node:path');
const fs = require('node:fs');
async function captureSections(page, width) {
  await page.locator('img').evaluateAll(async images => {
    images.forEach(e => { e.loading = 'eager'; });
    await Promise.all(images.map(e => e.decode().catch(() => {})));
  });
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 700) {
    await page.evaluate(y => scrollTo(0, y), y);
    await page.waitForTimeout(50);
  }
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(100);
  const boxes = {};
  for (const [name, selector] of [['flash', '.flash-section'], ['categories', '.category-section'], ['catalog', '.explore-section'], ['arrivals', '.new-arrival-section']]) {
    const rect = await page.locator(selector).boundingBox();
    boxes[name] = rect;
    await page.screenshot({ path: path.join(__dirname, name + '-' + width + '.png'), fullPage: true, clip: rect, animations: 'disabled' });
  }
  fs.writeFileSync(path.join(__dirname, 'capture-' + width + '.json'), JSON.stringify({ viewport: width, method: 'Full-page screenshot clipped to section document coordinates from scrollY=0, no CSS changes or hidden UI', boxes }, null, 2) + '\n');
}
module.exports = captureSections;
if (require.main === module) {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  (async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
    try {
      for (const width of [360, 768]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        await page.goto('http://127.0.0.1:4173/web-practice/', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await captureSections(page, width);
        await page.close();
      }
    } finally { await browser.close(); }
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
