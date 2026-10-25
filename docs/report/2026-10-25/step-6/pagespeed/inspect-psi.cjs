const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(30000);
  await page.goto('https://pagespeed.web.dev/analysis?url=https%3A%2F%2Ftetianna02.github.io%2Fweb-practice%2F&form_factor=mobile',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(15000);
  console.log(JSON.stringify({url:page.url(),frames:page.frames().map(f=>f.url()),text:(await page.locator('body').innerText()).slice(0,18000),buttons:await page.locator('button').evaluateAll(es=>es.map(e=>({text:e.innerText,label:e.getAttribute('aria-label')})))},null,2));
  await page.screenshot({path:path.join(__dirname,'psi-initial.png'),fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
