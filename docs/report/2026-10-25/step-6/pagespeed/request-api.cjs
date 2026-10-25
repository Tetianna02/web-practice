const fs = require('node:fs');
const path = require('node:path');
const target = 'https://tetianna02.github.io/web-practice/';
(async () => {
 const results = await Promise.all(['mobile','desktop'].map(async strategy => {
  const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  url.searchParams.set('url', target);
  url.searchParams.set('strategy', strategy);
  for (const c of ['performance','accessibility','best-practices','seo']) url.searchParams.append('category',c);
  try {
   const r = await fetch(url,{signal:AbortSignal.timeout(180000)});
   const body = await r.text();
   fs.writeFileSync(path.join(__dirname,strategy+'-api.json'),body);
   let data; try { data=JSON.parse(body); } catch {}
   return {strategy,status:r.status,at:new Date().toISOString(),lighthouse:!!data?.lighthouseResult,error:data?.error?.message};
  } catch(e) { return {strategy,error:e.message,at:new Date().toISOString()}; }
 }));
 fs.writeFileSync(path.join(__dirname,'api-attempt.json'),JSON.stringify({target,results},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})();
