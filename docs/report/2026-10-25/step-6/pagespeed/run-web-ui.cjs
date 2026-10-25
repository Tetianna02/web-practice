const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const target='https://tetianna02.github.io/web-practice/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(30000);
  const rpc=[];
  page.on('response',async r=>{if(r.url().includes('/data/batchexecute')){try{rpc.push({status:r.status(),text:await r.text()});}catch{}}});
  await page.goto('https://pagespeed.web.dev/?hl=en',{waitUntil:'domcontentloaded',timeout:60000});
  const inputs=await page.locator('input').evaluateAll(es=>es.map(e=>({type:e.type,label:e.getAttribute('aria-label'),placeholder:e.placeholder})));
  console.log(JSON.stringify({inputs}));
  await page.locator('input[type="text"],input[type="url"]').first().fill(target);
  await page.getByRole('button',{name:/Analyze|Аналізувати/}).click();
  let text='';
  for(let i=0;i<20;i++){
   await page.waitForTimeout(5000);text=await page.locator('body').innerText();
   console.log(JSON.stringify({seconds:(i+1)*5,url:page.url(),end:text.slice(-1500)}));
   if(/Unable to resolve|Unable to load|Не вдалося відкрити|Largest Contentful Paint|LARGEST CONTENTFUL PAINT/i.test(text))break;
  }
  fs.writeFileSync(path.join(__dirname,'web-ui-attempt.json'),JSON.stringify({at:new Date().toISOString(),target,url:page.url(),text,inputs,rpc},null,2)+'\n');
  await page.screenshot({path:path.join(__dirname,'web-ui-mobile.png'),fullPage:true});
  const desktop=page.getByRole('tab',{name:/Desktop|Комп/});
  if(await desktop.count()){
   await desktop.click();await page.waitForTimeout(3000);
   fs.writeFileSync(path.join(__dirname,'web-ui-desktop-text.txt'),await page.locator('body').innerText());
   await page.screenshot({path:path.join(__dirname,'web-ui-desktop.png'),fullPage:true});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
