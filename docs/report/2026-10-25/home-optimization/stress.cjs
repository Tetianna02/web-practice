const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const hitsOnly=process.argv.includes('--hits-only');
 const cases=hitsOnly?JSON.parse(fs.readFileSync(path.join(__dirname,'stress.json'),'utf8')).cases:[],hits=[];
 try{
  for(const width of [360,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:true});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/web-practice/',{waitUntil:'networkidle'});
   for(const count of (hitsOnly?[]:[0,1,8,11,100])){
    await page.evaluate(n=>{
     const products=Array.from({length:n},(_,i)=>({...saleProducts[0],id:'qa-'+i,name:'НадзвичайноДовгаНазваТоваруБезПробілів'.repeat(5)+' '+i}));
     renderProductList('flash',products,true);renderProductList('explore',products,true);updateProductVisibility();
     document.getElementById('category-grid').replaceChildren(...Array.from({length:n},(_,i)=>createCategoryButton({...categories[i%categories.length],name:i===0?'Смартгодинники':categories[i%categories.length].name},'category-card')));
    },count);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    for(const id of ['flash-products','category-grid','explore-grid']){
     const result=await page.evaluate(async id=>{
      const rail=document.getElementById(id),buttons=[...document.querySelectorAll('[data-scroll="'+id+'"]')];
      const back=buttons.find(b=>Number(b.dataset.direction)<0),next=buttons.find(b=>Number(b.dataset.direction)>0);
      const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      rail.scrollLeft=0;await frame();
      const max=Math.max(0,rail.scrollWidth-rail.clientWidth),keep=id==='explore-grid'&&innerWidth>=1024;
      const initial=back.disabled&&((max<=2)?next.disabled:!next.disabled);
      const visibility=buttons.every(b=>b.hidden===(max<=2&&!keep));
      let forward=0,reverse=0;
      while(max>2&&!next.disabled&&forward<120){next.click();forward++;await frame();}
      const end=next.disabled&&rail.scrollLeft>=max-2;
      while(max>2&&!back.disabled&&reverse<120){back.click();reverse++;await frame();}
      const start=back.disabled&&rail.scrollLeft<=2;
      rail.focus();rail.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await frame();
      const keyboardEnd=rail.scrollLeft>=max-2;
      rail.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));await frame();
      return{id,max,height:rail.getBoundingClientRect().height,initial,visibility,end,start,keyboardEnd,keyboardHome:rail.scrollLeft<=2,forward,reverse,documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
     },id);
     cases.push({width,count,...result});
    }
    if(count===1){await page.locator('.product-image').first().evaluate(e=>e.dispatchEvent(new Event('error')));if(!await page.locator('.image-fallback').first().isVisible())throw Error('Missing-image fallback failed');}
   }
   await page.reload({waitUntil:'networkidle'});
   for(const selector of ['.hero-dot','.product-swatch','.social-links button']){
    const element=page.locator(selector).first();await element.scrollIntoViewIfNeeded();
    const hit=await element.evaluate(e=>{const b=e.getBoundingClientRect(),p=getComputedStyle(e,'::after'),w=parseFloat(p.width),h=parseFloat(p.height);const x=b.x+b.width/2,y=b.y+b.height/2,swatch=e.classList.contains('product-swatch');return{class:e.className,visibleWidth:b.width,visibleHeight:b.height,hitWidth:w,hitHeight:h,outsideVisualHit:swatch?(document.elementFromPoint(x+13,y)?.closest('button')===e&&document.elementFromPoint(x,y-13)?.closest('button')===e):document.elementFromPoint(x,y+11)?.closest('button')===e};});
    hits.push({width,...hit});
   }
   if(width===360){
    const rail=page.locator('#flash-products');await rail.scrollIntoViewIfNeeded();
    const box=await rail.boundingBox(),cdp=await context.newCDPSession(page),y=Math.min(850,box.y+80);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y}]});
    for(let x=260;x>=60;x-=20){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
    const left=await rail.evaluate(e=>e.scrollLeft);hits.push({width,touchSwipeScrollLeft:left,passed:left>0});
   }
   await context.close();console.log(width+': stress complete');
  }
 }finally{await browser.close();}
 const failed=cases.filter(c=>!c.initial||!c.visibility||!c.end||!c.start||!c.keyboardEnd||!c.keyboardHome||c.documentOverflow);
 const heights=Object.fromEntries([360,768,1024,1440].map(width=>[width,Object.fromEntries(['flash-products','category-grid','explore-grid'].map(id=>[id,[...new Set(cases.filter(c=>c.width===width&&c.id===id).map(c=>c.height))]]))]));
 const result={cases,hits,heights,failed,passed:!failed.length&&hits.every(h=>h.passed??(h.hitWidth>=24&&h.hitHeight>=24&&h.outsideVisualHit))};
 fs.writeFileSync(path.join(__dirname,'stress.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({cases:cases.length,failed,heights,hits,passed:result.passed},null,2));
 if(!result.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
