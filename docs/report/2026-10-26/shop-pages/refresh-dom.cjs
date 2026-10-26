const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const report=JSON.parse(fs.readFileSync(path.join(__dirname,'final-checks.json'),'utf8'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
for(const name of ['product','checkout','account']){
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4183/web-practice/'+name+'.html',{waitUntil:'networkidle'});
 fs.writeFileSync(path.join(report.validatorTemp,name+'-dom.html'),await p.content());
 if(name!=='product'){await p.locator(name==='checkout'?'.checkout-submit':'.account-save').click();if(name==='account'){await p.locator('#account-email').fill('wrong');await p.locator('.account-save').click();}fs.writeFileSync(path.join(report.validatorTemp,name+'-errors-dom.html'),await p.content());}
 assert.deepEqual(errors,[]);await p.close();
}console.log('DOM refreshed after semantic-only fixes.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
