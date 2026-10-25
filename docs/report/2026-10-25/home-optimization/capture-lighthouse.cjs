const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{const page=await browser.newPage({viewport:{width:1440,height:1100}});for(const name of ['before-mobile','after-mobile','before-desktop','after-desktop']){await page.goto(pathToFileURL(path.join(__dirname,'lighthouse',name+'.report.html')).href);await page.waitForSelector('.lh-root');await page.screenshot({path:path.join(__dirname,'lighthouse',name+'.png')});}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
