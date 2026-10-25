const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const git = args => execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c','safe.directory='+repo.replace(/\\/g,'/'),'-c','core.quotePath=false',...args],{cwd:repo,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const tracked = git(['ls-files','-z']).split('\0').filter(Boolean);
const size = files => files.reduce((n,f)=>n+fs.statSync(path.join(repo,f)).size,0);
const groups = Object.fromEntries(['docs/report/','design/','assets/images/','assets/fonts/'].map(prefix=>[prefix,{files:tracked.filter(f=>f.startsWith(prefix)).length,bytes:size(tracked.filter(f=>f.startsWith(prefix)))}]));
const envTracked=tracked.filter(f=>/^\.env(?:\.|$)/i.test(path.basename(f)));
const envDisk=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='.git'||e.name==='node_modules')continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else if(/^\.env(?:\.|$)/i.test(e.name))envDisk.push(path.relative(repo,full));}}
walk(repo);
const rules = [
 ['GitHub token',/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/g],
 ['OpenAI-style key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/g],
 ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/g],
 ['Private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['Credentialed PostgreSQL URL',/postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"/]{4,}@[^\s'"<>]+/g],
 ['Quoted secret assignment',/\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|DB_PASSWORD)\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{16,}["']/gi]
];
function inspect(text, location, hits){for(const [rule,re]of rules){re.lastIndex=0;for(const m of text.matchAll(re)){const line=text.slice(0,m.index).split('\n').length;hits.push({location,rule,line});}}}
const currentHits=[];let scannedCurrent=0;
for(const file of tracked){const b=fs.readFileSync(path.join(repo,file));if(b.includes(0))continue;inspect(b.toString('utf8'),file,currentHits);scannedCurrent++;}
const historyHits=[],historyEnv=[];let scannedHistory=0;
const objects=git(['rev-list','--objects','--all']).split('\n').map(line=>{const i=line.indexOf(' ');return{oid:i<0?line:line.slice(0,i),file:i<0?'':line.slice(i+1)};});
for(const object of objects){if(!object.file)continue;if(/^\.env(?:\.|$)/i.test(path.basename(object.file)))historyEnv.push({oid:object.oid,path:object.file});
 if(!/\.(?:html|css|js|cjs|mjs|json|md|txt|ya?ml|toml|ps1|bat|har|env|pem|key)$/i.test(object.file)&&!/^\.env/i.test(path.basename(object.file)))continue;
 if(git(['cat-file','-t',object.oid])!=='blob')continue;
 const b=execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+repo.replace(/\\/g,'/'),'cat-file','blob',object.oid],{cwd:repo,maxBuffer:16*1024*1024});if(b.includes(0))continue;
 inspect(b.toString('utf8'),object.file+' @ '+object.oid.slice(0,12),historyHits);scannedHistory++;
}
const resourceReport=JSON.parse(fs.readFileSync(path.join(repo,'docs/report/2026-10-25/step-5/resources.json'),'utf8'));
const needed=[...new Set(resourceReport.manifest.map(r=>r.path))];
const neededFiles=needed.map(file=>({file,exists:fs.existsSync(path.join(repo,file)),tracked:tracked.includes(file),sha256:fs.existsSync(path.join(repo,file))?crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex'):null}));
const result={date:'2026-10-25',head:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),remote:git(['remote','get-url','origin']),expectedUrl:'https://tetianna02.github.io/web-practice/',rootIndex:tracked.includes('index.html'),
 trackedFiles:tracked.length,trackedBytes:size(tracked),groups,largest:tracked.map(file=>({file,bytes:fs.statSync(path.join(repo,file)).size})).sort((a,b)=>b.bytes-a.bytes).slice(0,12),gitObjects:git(['count-objects','-vH']),
 envTracked,envDisk,historyEnv,currentHits,historyHits,scannedCurrent,scannedHistory,neededFiles,neededComplete:neededFiles.every(r=>r.exists&&r.tracked),
 limitation:'Heuristic scan of tracked text and matching historical blobs; this is not a mathematical guarantee that no possible secret exists. Matched values are never printed.'};
fs.writeFileSync(path.join(__dirname,'repository-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({rootIndex:result.rootIndex,neededComplete:result.neededComplete,files:result.trackedFiles,totalMiB:result.trackedBytes/1024/1024,groups:result.groups,envTracked,envDisk,historyEnv,currentHits,historyHits,scannedCurrent,scannedHistory},null,2));
if(envTracked.length||envDisk.length||historyEnv.length||currentHits.length||historyHits.length||!result.neededComplete)process.exitCode=1;
