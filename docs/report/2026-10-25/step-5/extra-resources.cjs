const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../../..');
(async () => {
 const rows=[];
 for(const channel of ['chrome','msedge']) {
  const b=await chromium.launch({channel,headless:true});
  try {
   const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
   await p.goto('http://127.0.0.1:4173/web-practice/',{waitUntil:'networkidle'});
   const result=await p.evaluate(()=>({
    supports:Object.fromEntries([
     ['width','min(100% - (16px * 2), 1170px)'],['container-type','inline-size'],
     ['height','max(148px, calc((100cqw - (1.75 - 1) * 12px) / 1.75 * 1.15))'],
     ['width','min(416px, calc((100cqw - 56px) * 0.9 / 1.9 * 1.3 + 23.4px), calc(100cqw - 250px))'],
     ['width','clamp(416px, 50cqw, 496px)'],['width','calc(50% + 50cqw)']
    ].map(([prop,value])=>[prop+': '+value,CSS.supports(prop,value)])),
    icons:[...document.querySelectorAll('svg use')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBBox();return{href:e.getAttribute('href'),width:r.width,height:r.height};}),
    cssSprite:[...document.querySelectorAll('.service-sprite')].map(e=>({image:getComputedStyle(e).backgroundImage,width:getComputedStyle(e).width,height:getComputedStyle(e).height}))
   }));
   rows.push({browser:channel,version:await b.version(),...result});
  } finally {await b.close();}
 }
 const atlas=fs.readFileSync(path.join(repo,'assets/images/icons/service-icons-css-sprite.svg'),'utf8');
 const ids=[...atlas.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const references=[...atlas.matchAll(/url\(#([^)]+)\)/g)].map(m=>({id:m[1],exists:ids.includes(m[1])}));
 const passed=rows.every(r=>Object.values(r.supports).every(Boolean)&&r.icons.every(i=>i.width>0&&i.height>0)&&r.cssSprite.length===3&&r.cssSprite.every(i=>i.image.includes('service-icons-css-sprite.svg')))&&references.every(r=>r.exists);
 fs.writeFileSync(path.join(__dirname,'extra-resources.json'),JSON.stringify({passed,rows,atlasReferences:references},null,2)+'\n');
 console.log(JSON.stringify({passed,rows:rows.map(r=>({browser:r.browser,visibleIcons:r.icons.length,empty:r.icons.filter(i=>!i.width||!i.height),unsupported:Object.entries(r.supports).filter(([,v])=>!v)})),atlasReferences:references},null,2));
 if(!passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
