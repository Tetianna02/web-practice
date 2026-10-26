const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base='http://127.0.0.1:8000/',results={pages:[],returnFrom404:[],passed:false};
async function ready(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(e=>{e.loading='eager';return e.decode();}));});}
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
for(const file of ['login.html','signup.html','404.html'])for(const width of [360,768,1024,1280,1440]){
 const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],bad=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()!==200)bad.push({url:r.url(),status:r.status()});});
 await p.goto(base+file,{waitUntil:'networkidle'});await ready(p);
 const geometry=await p.evaluate(()=>{const group=document.querySelector('.auth-announcement-message'),r=group?.getBoundingClientRect();const search=document.querySelector('.desktop-search').getBoundingClientRect(),nav=document.querySelector('.desktop-navigation').getBoundingClientRect();return{scrollWidth:document.documentElement.scrollWidth,width:innerWidth,centerDelta:r?r.x+r.width/2-innerWidth/2:null,barHeight:document.querySelector('.announcement-bar').getBoundingClientRect().height,headerOverlap:Math.max(0,nav.right-search.left),styles:[...document.styleSheets].map(s=>s.href)};});
 assert.equal(geometry.scrollWidth,width);if(file!=='404.html')assert(Math.abs(geometry.centerDelta)<.1);if(width>=1024)assert.equal(geometry.headerOverlap,0);
 if(width===360){await p.locator('.menu-toggle').click();assert(await p.locator('.mobile-navigation').isVisible());await p.keyboard.press('Escape');}
 if(file!=='404.html'){await p.locator('.account-submit').click();assert.equal(await p.locator('[data-account-form] [aria-invalid="true"]').count(),file==='login.html'?2:3);}
 if([360,768,1440].includes(width)){if(file!=='404.html')await p.locator('[data-account-form]').evaluate(f=>FormValidation.clear(f));await p.evaluate(()=>document.activeElement.blur());await p.screenshot({path:path.join(__dirname,file.replace('.html','')+'-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);results.pages.push({file,width,geometry,errors,bad,passed:true});await p.close();
}
for(const entry of ['404.html','/web-practice/404.html','/web-practice/missing/nested-page'])for(const width of [360,1440]){
 const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],bad=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});p.on('response',r=>{if(r.status()!==200&&!(r.request().isNavigationRequest()&&r.status()===404))bad.push({url:r.url(),status:r.status()});});
 const response=await p.goto(new URL(entry,base).href,{waitUntil:'networkidle'});assert.equal(response.status(),entry.includes('missing')?404:200);await ready(p);await p.locator('.error-home').click();await p.waitForURL('**/web-practice/index.html');await ready(p);
 assert.equal(await p.locator('link[href*="auth-pages.css"]').count(),0);assert.equal(await p.locator('body').getAttribute('class'),null);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
 const mainCSS=await p.evaluate(()=>[...document.styleSheets].map(s=>new URL(s.href).pathname));assert.deepEqual(mainCSS,['/web-practice/assets/css/_variables.css','/web-practice/assets/css/style.css']);
 if(width===360){await p.locator('.menu-toggle').click();assert(await p.locator('.mobile-navigation').isVisible());assert.equal(await p.locator('[data-category-list="mobile"] button').count(),9);await p.keyboard.press('Escape');}
 else {assert(await p.locator('.category-sidebar').isVisible());assert.equal(await p.locator('[data-category-list="desktop"] button').count(),9);}
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);results.returnFrom404.push({entry,width,status:response.status(),destination:p.url(),mainCSS,passed:true});await p.close();
}
results.passed=true;
}finally{await browser.close();fs.writeFileSync(path.join(__dirname,'CHECKS.json'),JSON.stringify(results,null,2)+'\n');}console.log(JSON.stringify({passed:results.passed,pages:results.pages.length,returns:results.returnFrom404.length}));})().catch(e=>{console.error(e);process.exitCode=1;});
