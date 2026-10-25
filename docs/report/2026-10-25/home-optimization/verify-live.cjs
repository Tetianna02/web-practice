const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=path.resolve(__dirname,'../../../..');
const git=args=>execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+repo.replace(/\\/g,'/'),...args],{cwd:repo,maxBuffer:8*1024*1024});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const base='https://tetianna02.github.io/web-practice/';
(async()=>{
 const deployment=await (await fetch('https://api.github.com/repos/Tetianna02/web-practice/actions/runs/40234787011',{headers:{'User-Agent':'Home-coursework-validation'}})).json();
 const r=await fetch(base),body=Buffer.from(await r.arrayBuffer());
 const head=git(['rev-parse','HEAD']).toString().trim();
 const entry={at:new Date().toISOString(),head,url:base,status:r.status,matchesCommitted:hash(body)===hash(git(['show','HEAD:index.html'])),deployment:{id:deployment.id,status:deployment.status,conclusion:deployment.conclusion,head:deployment.head_sha,url:deployment.html_url}};
 if(!entry.matchesCommitted||deployment.conclusion!=='success'){console.log(JSON.stringify(entry,null,2));process.exitCode=2;return;}
 const files=[...new Map(JSON.parse(fs.readFileSync(path.join(__dirname,'after/resources.json'),'utf8')).manifest.map(f=>[f.path,f])).values()];
 const assets=[];
 for(let i=0;i<files.length;i+=4)assets.push(...await Promise.all(files.slice(i,i+4).map(async f=>{const u=new URL(f.path,base),res=await fetch(u),b=Buffer.from(await res.arrayBuffer());return{path:f.path,status:res.status,bytes:b.length,sha256:hash(b),matchesCommitted:hash(b)===hash(git(['show','HEAD:'+f.path]))};})));
 const browser=await chromium.launch({headless:true,channel:'chrome'}),runs=[];
 try{
  for(const width of [1440,360]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),consoleErrors=[],errors=[],failures=[],responses=[];
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
   await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));await page.waitForFunction(()=>[...document.images].every(e=>e.complete&&e.naturalWidth));
   const priority=await page.locator('[data-hero-image]').getAttribute('fetchpriority');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   await page.screenshot({path:path.join(__dirname,'live-'+width+'.png')});
   if(width===360){await page.locator('.menu-toggle').click();await page.screenshot({path:path.join(__dirname,'live-menu.png')});}
   await page.locator(width===360?'.mobile-navigation [data-open-auth]':'.desktop-navigation [data-open-auth]').click();
   await page.locator('.form-submit').click();const invalid=await page.locator('.auth-form [aria-invalid="true"]').count();
   if(width===360)await page.screenshot({path:path.join(__dirname,'live-modal.png')});
   await page.keyboard.press('Escape');const modalClosed=!(await page.locator('.auth-dialog').isVisible());
   await context.close();runs.push({width,priority,overflow,invalid,modalClosed,consoleErrors,errors,failures,responses});
  }
 }finally{await browser.close();}
 const result={...entry,assets,runs,passed:assets.every(a=>a.status===200&&a.matchesCommitted)&&runs.every(r=>r.priority==='high'&&!r.overflow&&r.invalid>0&&r.modalClosed&&!r.consoleErrors.length&&!r.errors.length&&!r.failures.length&&r.responses.every(a=>a.status===200))};
 fs.writeFileSync(path.join(__dirname,'live-verification.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({head,deployment:entry.deployment,assets:assets.length,all200:assets.every(a=>a.status===200),allMatchCommitted:assets.every(a=>a.matchesCommitted),runs:runs.map(r=>({width:r.width,requests:r.responses.length,consoleErrors:r.consoleErrors,errors:r.errors,failures:r.failures,priority:r.priority,invalid:r.invalid,modalClosed:r.modalClosed})),passed:result.passed},null,2));
 if(!result.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
