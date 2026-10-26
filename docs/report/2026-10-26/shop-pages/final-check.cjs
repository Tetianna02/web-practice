const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const pw = require(process.env.PLAYWRIGHT_MODULE);
const names = ['product', 'cart', 'checkout', 'account'];
const base = 'http://127.0.0.1:4183/web-practice/';
const report = { date: '2026-10-26', responsive: [], browsers: [], stress: [], regressions: [], flow: {}, passed: false };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'exclusive-shop-validation-'));
const selectors = {
  product: ['.product-detail', '.product-thumbnails', '.product-main-image', '.product-main-image img', '.product-summary', '.product-detail-title', '.product-detail-price', '.product-description', '.product-options', '.product-buy-row', '.delivery-information', '.related-title', '.related-grid'],
  cart: ['.cart-table', '.cart-table-header', '.cart-row', '.cart-actions', '.cart-bottom', '.cart-summary'],
  checkout: ['.checkout-layout', '.checkout-title', '#checkout-first-name', '#checkout-email', '.checkout-item', '.checkout-totals', '.checkout-payment', '[data-checkout-coupon]', '.checkout-submit'],
  account: ['.account-layout-new', '[data-account-panel="profile"]', '.account-panel-title', '#account-first-name', '#account-email', '#account-current-password', '#account-new-password', '#account-confirm-password', '.account-form-actions', '.account-save']
};
async function load(page, name) {
  const errors = [], bad = [], posts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() !== 200) bad.push({ url: r.url(), status: r.status() }); });
  page.on('requestfailed', r => bad.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('request', r => { if (r.method() !== 'GET') posts.push({ method: r.method(), url: r.url() }); });
  await page.goto(base + name + '.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled([...document.images].map(e => { e.loading = 'eager'; return e.decode(); })); });
  return { errors, bad, posts };
}
async function geometry(p, name) {
  return p.evaluate(sel => {
    const boxes = Object.fromEntries([...sel, '.announcement-bar', '.site-header', '.site-footer'].map(s => {
      const e = document.querySelector(s); if (!e) return [s, null];
      const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      return [s, { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing }];
    }));
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, boxes };
  }, selectors[name] || []);
}
async function interaction(p, name, width) {
  if (width < 1024) {
    await p.locator('.menu-toggle').click(); assert(await p.locator('.mobile-navigation').isVisible());
    await p.keyboard.press('Escape'); assert(await p.locator('.menu-toggle').evaluate(e => e === document.activeElement));
    await p.locator('.menu-toggle').click(); await p.locator('.menu-close').click(); assert(await p.locator('.mobile-navigation').isHidden());
  }
  if (name === 'product') {
    await p.locator('[data-gallery-image]').nth(2).click(); assert((await p.locator('[data-main-product-image]').getAttribute('src')).includes('gamepad-4'));
    await p.locator('.product-sizes button').first().click(); assert.equal(await p.locator('.product-sizes button').first().getAttribute('aria-pressed'), 'true');
    const initialQuantity = Number(await p.locator('#detail-quantity').inputValue());
    await p.locator('[data-quantity-more]').click(); assert.equal(Number(await p.locator('#detail-quantity').inputValue()), initialQuantity + 1);
  }
  if (name === 'cart') {
    await p.locator('.cart-quantity input').first().fill('99'); await p.locator('.cart-quantity input').first().dispatchEvent('change');
    assert(await p.locator('.cart-quantity button').first().isDisabled());
    await p.locator('.cart-remove').first().click(); await p.locator('.cart-remove').first().click(); assert(await p.locator('.cart-empty').isVisible());
  }
  if (name === 'checkout') {
    await p.locator('.checkout-submit').click(); assert.equal(await p.locator('[aria-invalid="true"]').count(), 5);
    assert(await p.locator('#checkout-first-name').evaluate(e => e === document.activeElement));
    for (const [k, v] of Object.entries({ 'first-name': 'Анна', street: 'Навчальна, 1', city: 'Київ', phone: '+380500000000', email: 'student@example.com' })) await p.locator('#checkout-' + k).fill(v);
    await p.locator('.checkout-submit').click(); assert.equal(await p.locator('[aria-invalid="true"]').count(), 0);
    assert((await p.locator('[data-checkout-status]').innerText()).includes('не надіслано'));
  }
  if (name === 'account') {
    await p.locator('#account-first-name').fill(''); await p.locator('.account-save').click(); assert.equal(await p.locator('[aria-invalid="true"]').count(), 1);
    await p.locator('.account-cancel').click(); assert.equal(await p.locator('#account-first-name').inputValue(), 'Анна');
    await p.locator('#account-new-password').fill('new12345'); await p.locator('.account-save').click(); assert.equal(await p.locator('[aria-invalid="true"]').count(), 2);
    await p.locator('.account-cancel').click(); await p.locator('.account-save').click(); assert((await p.locator('[data-profile-status]').innerText()).includes('не збережено'));
    await p.locator('[data-show-account="orders"]').click(); assert(await p.locator('#orders').isVisible()); await p.locator('[data-show-account="profile"]').click();
  }
  await p.locator('.shop-profile-toggle').click(); assert(await p.locator('.shop-account-menu').isVisible());
  await p.keyboard.press('Escape'); assert(await p.locator('.shop-account-menu').isHidden());
  assert(await p.locator('.shop-profile-toggle').evaluate(e => e === document.activeElement));
}
(async () => {
  const chrome = await pw.chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const name of names) {
      for (const width of [320, 360, 480, 640, 768, 900, 1023, 1024, 1280, 1440, 1920]) {
        const p = await chrome.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        const log = await load(p, name), g = await geometry(p, name); assert.equal(g.scrollWidth, width, name + ' overflow ' + width);
        const audit = await p.evaluate(() => {
          const missingLabels = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(e => !e.labels?.length && !e.getAttribute('aria-label'));
          return { h1: document.querySelectorAll('h1').length, title: document.title.length, description: document.querySelector('meta[name="description"]').content.length, missingAlt: document.querySelectorAll('img:not([alt])').length, missingLabels: missingLabels.map(e => e.id), inlineStyles: document.querySelectorAll('style').length, missingDefer: document.querySelectorAll('script[src]:not([defer])').length, brokenImages: [...document.images].filter(e => !e.naturalWidth).map(e => e.src), duplicateIds: [...document.querySelectorAll('[id]')].map(e => e.id).filter((id,i,a) => a.indexOf(id) !== i), fonts: document.fonts.status };
        });
        assert.equal(audit.h1, 1); assert(audit.title <= 65); assert(audit.description <= 160);
        for (const k of ['missingAlt', 'inlineStyles', 'missingDefer']) assert.equal(audit[k], 0, k);
        for (const k of ['missingLabels', 'brokenImages', 'duplicateIds']) assert.deepEqual(audit[k], [], k);
        if ([360, 768, 1440].includes(width)) await p.screenshot({ path: path.join(__dirname, name + '-' + width + '.png'), fullPage: true });
        if (width === 1440) {
          const expected = { product: 2093, cart: 1743, checkout: 1795, account: 1533 }[name]; assert.equal(g.height, expected);
          fs.writeFileSync(path.join(temp, name + '-dom.html'), await p.content());
        }
        if ([360, 1440].includes(width)) {
          await interaction(p, name, width);
          if (width === 1440 && ['checkout','account'].includes(name)) {
            const target = name === 'checkout' ? '.checkout-submit' : '.account-save';
            await p.locator(name === 'checkout' ? '#checkout-email' : '#account-email').fill('wrong'); await p.locator(target).click();
            fs.writeFileSync(path.join(temp, name + '-errors-dom.html'), await p.content());
          }
        }
        assert.deepEqual(log.errors, [], name + ' console'); assert.deepEqual(log.bad, [], name + ' resources'); assert.deepEqual(log.posts, []);
        report.responsive.push({ page: name, width, passed: true, audit, ...(width === 1440 ? { geometry: g } : {}) });
        await p.close();
      }
      console.log('Responsive ' + name + ': passed');
    }
    for (const name of names) for (const width of [360, 768, 1440]) {
      const p = await chrome.newPage({ viewport: { width, height: 1000 } }); await load(p, name);
      await p.evaluate(() => {
        document.querySelectorAll('.product-detail-title,.related-card h3,.cart-product > :last-child,.checkout-item-name,.account-panel-title').forEach(e => e.textContent = 'ДужеДовгаНазваБезПробілів'.repeat(15));
        document.querySelectorAll('.shop-field-error').forEach(e => e.textContent = 'Дуже довге повідомлення про помилку введення. '.repeat(8));
      });
      assert.equal((await geometry(p,name)).scrollWidth,width,name+' long text');
      await p.evaluate(() => { document.querySelectorAll('[data-image-frame] img,.product-thumbnail img').forEach(e => { e.src = 'data:image/png;base64,AAAA'; e.dispatchEvent(new Event('error')); }); });
      assert.equal((await geometry(p,name)).scrollWidth,width,name+' missing images');
      report.stress.push({ page:name,width,longText:true,missingImages:true,passed:true }); await p.close();
    }
    const p = await chrome.newPage({ viewport: {width:360,height:1000} }); await load(p,'product');
    await p.locator('.product-buy-button').click(); await p.waitForURL('**/cart.html'); assert.equal(await p.locator('.cart-items .cart-row').count(),3);
    await p.locator('.cart-checkout').click(); await p.waitForURL('**/checkout.html'); assert.equal(await p.locator('.checkout-item').count(),3);
    await p.goto(base+'account.html#orders'); assert(await p.locator('#orders').isVisible());
    report.flow={productToCartToCheckout:true,accountOrdersAnchor:true,passed:true};await p.close();
    for(const name of ['index','login','signup','404']) for(const width of [360,1440]){
      const p=await chrome.newPage({viewport:{width,height:1000}});const log=await load(p,name);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
      if(width===360){await p.locator('.menu-toggle').click();await p.keyboard.press('Escape');assert(await p.locator('.mobile-navigation').isHidden());}
      assert.deepEqual(log.errors,[]);assert.deepEqual(log.bad,[]);report.regressions.push({page:name,width,passed:true});await p.close();
    }
    for(const name of ['checkout','account']){
      const ctx=await chrome.newContext({javaScriptEnabled:false});const p=await ctx.newPage();await p.goto(base+name+'.html');assert(await p.locator(name==='checkout'?'.checkout-submit':'.account-save').isDisabled());await ctx.close();
    }
  } finally { await chrome.close(); }
  for(const engine of ['edge','firefox','webkit']){
    const browser=await (engine==='edge'?pw.chromium.launch({channel:'msedge',headless:true}):pw[engine].launch({headless:true}));
    try{for(const name of names)for(const width of [360,1440]){
      const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const log=await load(p,name);const g=await geometry(p,name);assert.equal(g.scrollWidth,width,engine+' '+name+' overflow');
      await interaction(p,name,width);assert.deepEqual(log.errors,[],engine+' '+name+' console');assert.deepEqual(log.bad,[],engine+' '+name+' resources');assert.deepEqual(log.posts,[]);
      report.browsers.push({engine,page:name,width,passed:true});await p.close();
    }console.log(engine+': passed');}finally{await browser.close();}
  }
  report.passed=true; console.log('All checks passed.');
})().catch(e=>{report.error=e.stack;console.error(e);process.exitCode=1;}).finally(()=>{report.validatorTemp=temp;fs.writeFileSync(path.join(__dirname,'final-checks.json'),JSON.stringify(report,null,2)+'\n');});
