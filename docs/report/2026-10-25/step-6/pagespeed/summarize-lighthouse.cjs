const fs=require('node:fs');
const path=require('node:path');
const folder=path.join(__dirname,'local-lighthouse');
const summaries=[];
for(const strategy of ['mobile','desktop']){
 const r=JSON.parse(fs.readFileSync(path.join(folder,strategy+'.report.json'),'utf8'));
 const ids=['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','mainthread-work-breakdown','color-contrast','target-size','unminified-css','cache-insight','forced-reflow-insight','image-delivery-insight','lcp-discovery-insight','render-blocking-insight','network-dependency-tree-insight','total-byte-weight','largest-contentful-paint-element'];
 const summary={source:'Local Lighthouse CLI, NOT PageSpeed Insights',strategy,fetchTime:r.fetchTime,lighthouseVersion:r.lighthouseVersion,requestedUrl:r.requestedUrl,finalDisplayedUrl:r.finalDisplayedUrl,runWarnings:r.runWarnings,runtimeError:r.runtimeError,configSettings:r.configSettings,categories:Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)])),audits:Object.fromEntries(ids.filter(id=>r.audits[id]).map(id=>[id,r.audits[id]]))};
 summaries.push(summary);
}
fs.writeFileSync(path.join(folder,'summary.json'),JSON.stringify(summaries,null,2)+'\n');
console.log(JSON.stringify(summaries.map(r=>({strategy:r.strategy,version:r.lighthouseVersion,time:r.fetchTime,categories:r.categories,warnings:r.runWarnings,error:r.runtimeError,metrics:Object.fromEntries(Object.entries(r.audits).filter(([id])=>['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift'].includes(id)).map(([id,v])=>[id,v.displayValue])),issues:Object.entries(r.audits).filter(([,v])=>v.score!==null&&v.score<1).map(([id,v])=>({id,score:v.score,value:v.displayValue,savings:v.metricSavings,itemCount:v.details?.items?.length,preview:JSON.stringify(v.details?.items?.slice(0,2)||[]).slice(0,800)}))})),null,2));
