const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../../..');
const base = 'https://tetianna02.github.io/web-practice/';
const domDir = path.join(__dirname, 'dom');
fs.mkdirSync(domDir, { recursive: true });
const checks = [], runs = [], urls = new Set(), fragments = new Set();
function check(name, passed, details) { checks.push({ name, passed: !!passed, details }); }
async function saveDom(page, name) { fs.writeFileSync(path.join(domDir, name + '.html'), await page.content()); }
async function audit(page) {
 return page.evaluate(() => {
  const heads = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')].map(e => ({ level: +e.tagName[1], text: e.textContent.trim() }));
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  return { title: document.title, description: document.querySelector('meta[name="description"]').content, lang: document.documentElement.lang,
   h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()), heads, duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
   imageCount: document.images.length, badImages: [...document.images].filter(e => !e.complete || !e.naturalWidth).map(e => e.src), missingAlt: [...document.images].filter(e => !e.getAttribute('alt')?.trim()).map(e => e.src),
   inputs: [...document.querySelectorAll('input')].map(e => ({ id: e.id, type: e.getAttribute('type'), labels: [...e.labels].map(l => l.textContent.trim()) })),
   brokenAriaRefs: [...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')].flatMap(e => ['aria-labelledby','aria-describedby','aria-controls'].flatMap(a => (e.getAttribute(a) || '').split(/\s+/).filter(id => id && !document.getElementById(id)).map(id => ({ element: e.outerHTML.slice(0,180), attribute: a, id })))),
   anchors: [...document.querySelectorAll('a[href]')].map(e => ({ href: e.getAttribute('href'), targetExists: !e.getAttribute('href').startsWith('#') || !!document.getElementById(e.getAttribute('href').slice(1)) })),
   resourceAttrs: [...document.querySelectorAll('[src],link[href],use[href]')].map(e => ({ tag: e.tagName, value: e.getAttribute('src') || e.getAttribute('href'), url: new URL(e.getAttribute('src') || e.getAttribute('href'), location.href).href })),
   sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(e => ({ href:e.getAttribute('href'), head:!!e.closest('head') })),
   scripts: [...document.scripts].map(e => ({ src:e.getAttribute('src'), defer:e.defer })), styleTags:document.querySelectorAll('style').length,
   pageWidth:document.documentElement.clientWidth,pageScroll:document.documentElement.scrollWidth,
   svgIcons:[...document.querySelectorAll('svg use')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBBox();return{href:e.getAttribute('href'),width:b.width,height:b.height};}),
   cssSprite:[...document.querySelectorAll('.service-sprite')].map(e=>({image:getComputedStyle(e).backgroundImage,width:parseFloat(getComputedStyle(e).width),height:parseFloat(getComputedStyle(e).height)})),
   cssSupport: Object.fromEntries([
    ['width','min(100% - (var(--page-gutter) * 2), var(--container-width))'],['fill','none'],['pointer-events','none'],['container-type','inline-size'],
    ['height','max(148px, calc((100cqw - (1.75 - 1) * 12px) / 1.75 * 1.15))'],
    ['width','min(416px, calc((100cqw - 56px) * 0.9 / 1.9 * 1.3 + 23.4px), calc(100cqw - 250px))'],['width','clamp(416px,50cqw,496px)'],['width','calc(50% + 50cqw)']
   ].map(([p,v]) => [p+': '+v,CSS.supports(p,v)])) };
 });
}
(async () => {
 for (const channel of ['chrome','msedge','firefox','webkit']) {
  const name = channel === 'msedge' ? 'edge' : channel;
  const browser = await (['chrome','msedge'].includes(channel) ? chromium.launch({headless:true,channel}) : ({firefox,webkit})[channel].launch({headless:true}));
  try {
   for (const width of [1440,360]) {
    const tag = name+'-'+width, consoleMessages=[], pageErrors=[], failed=[], responses=[], dialogs=[];
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',recordHar:{path:path.join(__dirname,tag+'.har'),content:'omit',mode:'full'}});
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    console.log(tag+': page created');
    page.on('console',m=>consoleMessages.push({type:m.type(),text:m.text()}));page.on('pageerror',e=>pageErrors.push(e.message));
    page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
    page.on('response',r=>{responses.push({url:r.url(),status:r.status(),type:r.request().resourceType(),method:r.request().method()});urls.add(r.url());});
    page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});
    await page.goto(base,{waitUntil:'networkidle'});console.log(tag+': loaded');await page.evaluate(()=>document.fonts.ready);
    await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
    await page.waitForFunction(()=>[...document.images].every(e=>e.complete&&e.naturalWidth>0));
    console.log(tag+': images loaded');
    await page.evaluate(async()=>{for(const weight of [400,500,600,700]) await document.fonts.load(weight+' 16px Poppins','ABC');await document.fonts.load('400 16px Inter','Україна ABC');});
    console.log(tag+': fonts loaded');
    for(let i=0;i<5;i++){await page.locator('.hero-dot').nth(i).click();await page.waitForFunction(()=>{const e=document.querySelector('[data-hero-image]');return e.complete&&e.naturalWidth>0;});}
    await page.locator('.hero-dot').nth(2).click();await page.waitForFunction(()=>{const e=document.querySelector('[data-hero-image]');return e.complete&&e.naturalWidth>0;});
    await page.waitForLoadState('networkidle');await page.evaluate(()=>scrollTo(0,0));
    const a=await audit(page);
    for(const r of a.resourceAttrs){urls.add(r.url);if(r.tag.toLowerCase()==='use')fragments.add(r.url);}
    check(tag+': meta/h1/lang',a.lang==='uk'&&a.title.length<=65&&a.description.length<=160&&a.h1.length===1,a.h1);
    check(tag+': heading hierarchy',a.heads.every((h,i,all)=>!i||h.level<=all[i-1].level+1),a.heads);
    check(tag+': unique IDs/ARIA references',!a.duplicateIds.length&&!a.brokenAriaRefs.length,{duplicateIds:a.duplicateIds,brokenAriaRefs:a.brokenAriaRefs});
    check(tag+': all images loaded with alt',!a.badImages.length&&!a.missingAlt.length,{count:a.imageCount,bad:a.badImages,alt:a.missingAlt});
    check(tag+': label/type',a.inputs.every(i=>i.type&&i.labels.length&&i.labels.every(Boolean)),a.inputs);
    check(tag+': CSS head / JS defer / no style tags',a.sheets.every(s=>s.head)&&a.scripts.every(s=>s.src&&s.defer)&&!a.styleTags);
    check(tag+': internal anchors',a.anchors.every(x=>x.targetExists),a.anchors);
    check(tag+': no horizontal page overflow',a.pageWidth===a.pageScroll);
    check(tag+': modern CSS parsed by browser',Object.values(a.cssSupport).every(Boolean),a.cssSupport);
    check(tag+': SVG icons and CSS Sprite render',a.svgIcons.length>0&&a.svgIcons.every(i=>i.width>0&&i.height>0)&&a.cssSprite.length===3&&a.cssSprite.every(i=>i.image.includes('service-icons-css-sprite.svg')&&i.width>0&&i.height>0),{svgIcons:a.svgIcons.length,emptyIcons:a.svgIcons.filter(i=>!i.width||!i.height),cssSprite:a.cssSprite});
    if(true){await saveDom(page,name+'-'+width+'-rendered');await page.screenshot({path:path.join(__dirname,tag+'-home.png'),fullPage:true,animations:'disabled'});}
    if(width<1024){
     await page.locator('.menu-toggle').click();check(tag+': menu search/navigation/categories',await page.locator('.mobile-navigation').isVisible()&&await page.locator('.mobile-navigation [data-sidebar-filter]').count()===9);
     await saveDom(page,name+'-menu-open');
     await page.screenshot({path:path.join(__dirname,tag+'-menu.png')});await page.keyboard.press('Escape');
     check(tag+': menu Escape restores focus',await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement));
    }
    const trigger=width===1440?'.desktop-navigation [data-open-auth]':'.mobile-navigation [data-open-auth]';
    if(width<1024)await page.locator('.menu-toggle').click();await page.locator(trigger).click();
    await page.locator('[data-auth-mode="register"]').click();
    if(width===1440)await saveDom(page,name+'-modal-register');
    await page.locator('.form-submit').click();
    check(tag+': registration validates/focus',await page.locator('#auth-name').evaluate(e=>e===document.activeElement)&&await page.locator('.auth-form [aria-invalid="true"]').count()>=4);
    await page.locator('[data-auth-mode="register"]').focus();await page.keyboard.press('ArrowRight');
    check(tag+': tabpanel label follows tab',await page.locator('#auth-panel').getAttribute('aria-labelledby')==='auth-tab-login'&&await page.locator('.auth-form').getAttribute('role')===null);
    if(width===1440)await saveDom(page,name+'-modal-login');
    await page.locator('.form-submit').click();check(tag+': login validates',await page.locator('.auth-form [aria-invalid="true"]').count()===2);
    await page.screenshot({path:path.join(__dirname,tag+'-modal.png')});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.auth-dialog').open);
    check(tag+': dialog restores focus',await page.locator(width===1440?trigger:'.menu-toggle').evaluate(e=>e===document.activeElement));
    for(const closeMode of ['button','outside']){
     if(width<1024)await page.locator('.menu-toggle').click();await page.locator(trigger).click();
     if(closeMode==='button')await page.locator('.dialog-close').click();else await page.mouse.click(2,2);
     await page.waitForFunction(()=>!document.querySelector('.auth-dialog').open);
    }
    check(tag+': dialog button/backdrop close',!(await page.locator('.auth-dialog').isVisible()));
    await page.locator('.cart-button').click();check(tag+': placeholder toast',await page.locator('.toast-message').last().textContent()==='Буде доступно на наступному етапі');
    const filterForm=width===1440?'.desktop-search':'.mobile-search';if(width<1024)await page.locator('.menu-toggle').click();
    await page.locator(filterForm+' input').fill('ASUS');await page.locator(filterForm+' button').click();
    check(tag+': search',await page.locator('.product-card:not([hidden])').count()===1);
    if(width<1024)await page.locator('.menu-toggle').click();await page.locator(filterForm+' input').fill('');await page.locator(filterForm+' button').click();
    check(tag+': search reset',await page.locator('.product-card:not([hidden])').count()===18);
    for(const id of ['flash-products','category-grid','explore-grid']){
     const target=page.locator('#'+id);await target.focus();await page.keyboard.press('End');await page.waitForTimeout(100);await page.keyboard.press('Home');
    }
    await page.waitForLoadState('networkidle');await context.close();
    check(tag+': Console/Network/JS clean',!pageErrors.length&&!failed.length&&!responses.some(r=>r.status>=400)&&!consoleMessages.some(m=>m.type==='error')&&!dialogs.length,{pageErrors,failed,dialogs});
    const run={browser:name,version:await browser.version(),width,url:base,audit:a,console:consoleMessages,pageErrors,failed,responses,dialogs};runs.push(run);
    fs.writeFileSync(path.join(__dirname,tag+'-runtime.json'),JSON.stringify(run,null,2)+'\n');
   }
  }finally{await browser.close();}
 }
 for(const css of ['_variables','style']){
  const source=fs.readFileSync(path.join(repo,'assets/css',css+'.css'),'utf8');
  for(const m of source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g))urls.add(new URL(m[1],base+'assets/css/'+css+'.css').href);
 }
 const tracked=new Set(execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+repo.replace(/\\/g,'/'),'ls-files'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/));
 const manifest=[];
 for(const url of [...urls].sort()){
  const u=new URL(url);if(u.origin!==new URL(base).origin||!u.pathname.startsWith('/web-practice/'))continue;
  let relative=decodeURIComponent(u.pathname.slice('/web-practice/'.length));if(!relative)relative='index.html';
  const parts=relative.split('/');let current=repo,exact=true,exists=true;
  for(const part of parts){if(!fs.existsSync(current)||!fs.statSync(current).isDirectory()){exists=false;break;}const names=fs.readdirSync(current);if(!names.includes(part)){exact=false;const found=names.find(n=>n.toLowerCase()===part.toLowerCase());if(!found){exists=false;break;}current=path.join(current,found);}else current=path.join(current,part);}
  manifest.push({url:u.origin+u.pathname,path:relative,exists,exactCase:exact,tracked:tracked.has(relative),size:exists?fs.statSync(current).size:null});
 }
 const spriteChecks=[...fragments].map(url=>{const u=new URL(url),relative=decodeURIComponent(u.pathname.slice('/web-practice/'.length)),id=u.hash.slice(1);const source=fs.readFileSync(path.join(repo,relative),'utf8');return{path:relative,id,exists:new RegExp('id=["\']'+id+'["\']').test(source)};});
 check('All referenced paths exist with exact case and tracked in Git',manifest.every(r=>r.exists&&r.exactCase&&r.tracked),manifest.filter(r=>!r.exists||!r.exactCase||!r.tracked));
 check('SVG Sprite fragment IDs exist with exact case',spriteChecks.every(r=>r.exists),spriteChecks);
 const staticHtml=fs.readFileSync(path.join(repo,'index.html'),'utf8'),runtimeJs=fs.readFileSync(path.join(repo,'assets/js/main.js'),'utf8'),css=fs.readFileSync(path.join(repo,'assets/css/style.css'),'utf8');
 check('Source DOCTYPE, charset/viewport first',/^<!DOCTYPE html>/.test(staticHtml)&&/<head>\s*<meta charset="UTF-8">\s*<meta name="viewport"/.test(staticHtml));
 check('No debug/conflict/Google Fonts/old countdown code',!/<<<<<<<|=======|>>>>>>>|\balert\s*\(|\bdebugger\b|console\.(log|debug)|fonts\.googleapis|localStorage|getSaleEnd|exploreVisibleLimit/.test(staticHtml+runtimeJs+css));
 fs.writeFileSync(path.join(__dirname,'resources.json'),JSON.stringify({manifest,spriteChecks},null,2)+'\n');
 const result={date:'2026-10-25',base,checks,passed:checks.filter(c=>c.passed).length,count:checks.length,runs:runs.map(r=>({browser:r.browser,version:r.version,width:r.width,requests:r.responses.length,errors:r.pageErrors.length,networkFailures:r.failed.length,consoleErrors:r.console.filter(m=>m.type==='error').length}))};
 fs.writeFileSync(path.join(__dirname,'browser-audit.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,count:result.count,failed:checks.filter(c=>!c.passed),runs:result.runs},null,2));
 if(checks.some(c=>!c.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
