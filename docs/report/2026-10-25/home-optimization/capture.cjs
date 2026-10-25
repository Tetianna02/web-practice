const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const stage=process.argv[2]||'before';
const out=path.join(__dirname,stage);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,360,768,1024]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const page=await context.newPage();
   await page.clock.setFixedTime(new Date('2026-10-25T20:00:00Z'));
   await page.goto('http://127.0.0.1:4173/web-practice/',{waitUntil:'networkidle'});
   await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
   await page.waitForFunction(()=>[...document.images].every(e=>e.complete&&e.naturalWidth));
   await page.evaluate(()=>document.fonts.ready);
   await page.mouse.move(0,0);await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true,animations:'disabled'});
   const geometry=await page.evaluate(()=>({
    document:{width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
    elements:[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&!e.closest('svg')).map((e,i)=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{index:i,tag:e.tagName,id:e.id,class:e.className,text:e.children.length?'':e.textContent.trim(),x:b.x,y:b.y,width:b.width,height:b.height,color:s.color,background:s.backgroundColor,font:s.font};}),
    smallControls:[...document.querySelectorAll('button,a,input')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return{tag:e.tagName,class:e.className,text:e.getAttribute('aria-label')||e.textContent.trim(),width:b.width,height:b.height};}).filter(e=>e.width<24||e.height<24)
   }));
   fs.writeFileSync(path.join(out,'geometry-'+width+'.json'),JSON.stringify(geometry,null,2)+'\n');
   if(width===1440){
    const dom=path.join(out,'dom');fs.mkdirSync(dom,{recursive:true});
    fs.writeFileSync(path.join(dom,'rendered.html'),await page.content());
    await page.locator('.desktop-navigation [data-open-auth]').click();
    for(const mode of ['register','login']){await page.locator('[data-auth-mode="'+mode+'"]').click();fs.writeFileSync(path.join(dom,'modal-'+mode+'.html'),await page.content());}
   }
   if(width===360){await page.locator('.menu-toggle').click();const dom=path.join(out,'dom');fs.mkdirSync(dom,{recursive:true});fs.writeFileSync(path.join(dom,'menu.html'),await page.content());}
   await context.close();console.log(stage+' '+width+': captured');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
