const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const selectors = [
  '.announcement-bar', '.header-inner', '.desktop-navigation', '.desktop-search',
  '.hero-section', '.category-sidebar', '.hero-banner', '.hero-brand-line',
  '.hero-title', '.hero-image', '.hero-pagination', '.flash-section .section-heading-row',
  '.flash-section .section-marker', '#flash-products', '#flash-products .product-card',
  '#flash-products .product-media', '#flash-products .product-image',
  '.flash-section .section-action-row .primary-button', '.category-section .section-heading-row',
  '.category-section .section-marker', '.category-grid', '.category-card',
  '.category-card .icon', '.best-selling-section .section-heading-row',
  '.best-selling-section .section-marker', '.best-selling-section .product-grid',
  '.promo-banner', '.promo-content', '.promo-title', '.promo-image-wrap', '.promo-image-wrap img',
  '.explore-section .section-heading-row', '.explore-section .section-marker',
  '#explore-grid', '#explore-grid .product-card', '#explore-grid .product-media',
  '.explore-section .section-action-row .primary-button',
  '.new-arrival-section .section-marker', '.arrival-grid', '.arrival-card-large',
  '.arrival-card-wide', '.arrival-card-small', '.services-grid', '.service-icon',
  '.site-footer', '.footer-grid', '.footer-column', '.footer-bottom'
];

(async () => {
  const label = process.argv[2] || 'current';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce'
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 800) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(100);
    }
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const metrics = await page.evaluate(selectors => {
      const boxes = {};
      for (const selector of selectors) {
        boxes[selector] = [...document.querySelectorAll(selector)].map(el => {
          const r = el.getBoundingClientRect(), s = getComputedStyle(el);
          return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height,
            font: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
            lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
            fit: s.objectFit, overflow: s.overflow, display: s.display };
        });
      }
      return { viewport: innerWidth, height: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth, boxes,
        unloadedImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src) };
    }, selectors);
    const png = path.join(__dirname, label + '-1440.png');
    await page.screenshot({ path: png, fullPage: true, animations: 'disabled' });
    if (label === 'after') {
      await page.locator('[data-category-filter="camera"]').hover();
      await page.locator('.category-section').screenshot({
        path: path.join(__dirname, 'category-hover.png'), animations: 'disabled'
      });
      await page.locator('#flash-products .product-card').nth(1).hover();
      await page.locator('#flash-products .product-card').nth(1).screenshot({
        path: path.join(__dirname, 'product-hover.png'), animations: 'disabled'
      });
    }
    fs.writeFileSync(path.join(__dirname, label + '-metrics.json'), JSON.stringify({ ...metrics, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ label, height: metrics.height, horizontalOverflow: metrics.horizontalOverflow,
      errors, unloadedImages: metrics.unloadedImages,
      sections: Object.fromEntries(selectors.filter(s => /marker|banner$|header-inner|category-grid|arrival-grid|services-grid|site-footer/.test(s)).map(s => [s, metrics.boxes[s]])) }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
