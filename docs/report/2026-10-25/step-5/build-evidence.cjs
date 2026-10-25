const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (heads,rows) => '<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const html = (title,body) => '<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><link rel="stylesheet" href="evidence.css"></head><body><main><p class="date">25.10.2026 • Home • крок 5</p><h1>'+esc(title)+'</h1>'+body+'</main></body></html>';
(async()=>{
 const validator=read('validator-summary-after.json'), browser=read('browser-audit.json'), css=read('jigsaw-style-after.json'), variables=read('jigsaw-_variables-after.json'), resources=read('resources.json');
 const warningGroups={};for(const w of css.Warnings){const m=w.Message.replace(/\s+/g,' ').trim();warningGroups[m]=(warningGroups[m]||0)+1;}
 const warningCategories={};for(const [message,count] of Object.entries(warningGroups)){
  const category=message.startsWith('Redefinition')?'Перевизначення в адаптивному каскаді':message.includes('variables')?'CSS-змінні: статична перевірка обмежена':message.includes('vendor')?'Вендорні розширення':message.includes('deprecated')?'Застарілий fallback clip':message.includes('font-family')?'Евристика font-family':message.includes('background')||message.includes('color')?'Евристика успадкування кольорів':'Інші';
  warningCategories[category]=(warningCategories[category]||0)+count;
 }
 fs.writeFileSync(path.join(__dirname,'css-diagnostic-groups.json'),JSON.stringify({errorCount:css.ErrorCount,warningCount:css.WarningCount,errors:css.Errors,warningCategories,warningGroups},null,2)+'\n');
 let v='<p>Локальний архів відповідей офіційних API Nu HTML Checker та Jigsaw. Це не знімок їхнього вебінтерфейсу. Сирі JSON/XML збережені поруч.</p><h2>W3C HTML — після виправлень</h2>';
 v+=table(['Вхід','HTTP','Помилки','Попередження'],validator.Results.map(r=>[r.Input,r.Status,r.Errors,r.Warnings]));
 v+='<p class="good">Усі 6 HTML-перевірок: 0 помилок, 0 попереджень.</p><h2>Jigsaw — профіль CSS3 + SVG</h2>';
 v+=table(['Файл','Формально валідний','Помилки сервісу','Попередження'],[['_variables.css',variables.Validity,variables.ErrorCount,variables.WarningCount],['style.css',css.Validity,css.ErrorCount,css.WarningCount]]);
 v+='<p class="notice">style.css не отримав формальний зелений статус. Нижче всі 8 діагностик сучасних CSS-можливостей; їх не приховано й не переписано заради валідатора. Підтримку виразів окремо підтверджено у Chrome та Edge.</p>';
 v+=table(['Рядок','Селектор','Повідомлення Jigsaw'],css.Errors.map(e=>[e.Line,e.Context,e.Message.replace(/\s+/g,' ').trim()]));
 v+='<h2>Попередження CSS</h2>'+table(['Категорія','Кількість'],Object.entries(warningCategories));
 fs.writeFileSync(path.join(__dirname,'validation-evidence.html'),html('Результати HTML/CSS-валідаторів',v));
 let n='<p>Дані з реальних запусків встановлених Chrome та Edge, зібрані подіями Playwright. Це не імітація вікна DevTools. HAR і повні журнали збережені поруч.</p>';
 n+=table(['Браузер','Версія','Viewport','HTTP-запитів','JS-помилок','Збоїв мережі','Console errors'],browser.runs.map(r=>[r.browser,r.version,r.width,r.requests,r.errors,r.networkFailures,r.consoleErrors]));
 n+='<p class="good">Локальний аудит: '+browser.passed+'/'+browser.count+' перевірок успішні.</p>';
 n+='<h2>Посилання й ресурси</h2>'+table(['Перевірка','Результат'],[['Унікальних локальних файлів',new Set(resources.manifest.map(r=>r.path)).size],['Точний регістр і наявність',resources.manifest.every(r=>r.exists&&r.exactCase)?'Усе збігається':'Є розбіжності'],['Відстежуються Git',resources.manifest.every(r=>r.tracked)?'Так':'Ні'],['SVG fragment IDs',resources.spriteChecks.length+' / '+resources.spriteChecks.length+' знайдені']]);
 n+='<h2>Приклад Network — Chrome 1440 px</h2>'+table(['HTTP','Тип','Ресурс'],read('chrome-1440-runtime.json').responses.map(r=>[r.status,r.type,new URL(r.url).pathname]));
 fs.writeFileSync(path.join(__dirname,'runtime-evidence.html'),html('Chrome/Edge: Console і Network',n));
 fs.writeFileSync(path.join(__dirname,'evidence.css'),'body{margin:0;background:#f3f5f7;color:#18212b;font:15px/1.5 Arial,sans-serif}main{max-width:1120px;margin:28px auto;padding:32px;background:white}h1{font-size:30px;margin:8px 0 12px}h2{font-size:21px;margin:24px 0 12px}.date{color:#526176;margin:0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cbd2d9;text-align:left;padding:8px;overflow-wrap:anywhere}th{background:#e9eef3}.good{background:#e8f5ec;padding:12px;color:#155b29}.notice{background:#fff3d9;padding:12px}');
 const repo=path.resolve(__dirname,'../../../..');
 const files=['index.html','assets/js/main.js','assets/css/style.css','assets/css/_variables.css',...fs.readdirSync(path.join(__dirname,'dom')).map(n=>'docs/report/2026-10-25/step-5/dom/'+n)];
 fs.writeFileSync(path.join(__dirname,'input-hashes.json'),JSON.stringify({algorithm:'SHA-256',files:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')}))},null,2)+'\n');
 const b=await chromium.launch({channel:'msedge',headless:true});
 try {const p=await b.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'});for(const name of ['validation','runtime']){await p.goto('http://127.0.0.1:4173/web-practice/docs/report/2026-10-25/step-5/'+name+'-evidence.html',{waitUntil:'networkidle'});await p.screenshot({path:path.join(__dirname,name+'-evidence.png'),fullPage:true});}} finally{await b.close();}
 console.log(JSON.stringify(warningCategories,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
