const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'resources.json'),'utf8')).manifest;
 const files=[...new Map(manifest.map(f=>[f.path,f])).values()];
 const results=[];
 // A small concurrency limit avoids generating a burst against the published site.
 for(let i=0;i<files.length;i+=4){
  results.push(...await Promise.all(files.slice(i,i+4).map(async f=>{
   const r=await fetch(f.url,{signal:AbortSignal.timeout(30000)});
   const b=Buffer.from(await r.arrayBuffer());
   const committed=execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+repo.replace(/\\/g,'/'),'show','HEAD:'+f.path],{cwd:repo,maxBuffer:8*1024*1024});
   return {path:f.path,url:f.url,status:r.status,bytes:b.length,sha256:hash(b),committedSha256:hash(committed),matchesCommitted:hash(b)===hash(committed),workingTreeByteIdentical:hash(b)===hash(fs.readFileSync(path.join(repo,f.path))),contentType:r.headers.get('content-type'),cacheControl:r.headers.get('cache-control')};
  })));
 }
 const result={at:new Date().toISOString(),target:'https://tetianna02.github.io/web-practice/',count:results.length,all200:results.every(r=>r.status===200),allMatchCommitted:results.every(r=>r.matchesCommitted),comparison:'Compare public bytes with HEAD Git blobs. Windows working-tree CRLF can differ from committed LF without a content change. SVG fragments are deduplicated by file path.',results};
 fs.writeFileSync(path.join(__dirname,'deployed-assets.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({count:result.count,all200:result.all200,allMatchCommitted:result.allMatchCommitted,problems:results.filter(r=>r.status!==200||!r.matchesCommitted)},null,2));
 if(!result.all200||!result.allMatchCommitted)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
