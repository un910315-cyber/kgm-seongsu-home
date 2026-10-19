'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {build,validDate}=require('../un/app-ops-calendar.js');
const fixtures=[
 {id:'first',carNum:'123가1234',carModel:'토레스',name:'예시 고객',inDate:'2026-09-28',outDate:'2026-10-03',status:'출고'},
 {id:'return',carNum:'123가1234',carModel:'토레스',name:'예시 고객',inDate:'2026-10-19',outDate:'2026-10-23',status:'수리중'},
 {id:'unrepaired',carNum:'456나5678',carModel:'렉스턴',inDate:'2026-10-01',outDate:'2026-10-19',status:'미수리 출고'},
 {id:'pending',carNum:'789다9012',carModel:'액티언',inDate:'2026-10-19',outDate:'',status:'입고'},
 {id:'missing',carNum:'901라2345',inDate:'invalid',outDate:'',status:'출고'},
 {id:'deleted',carNum:'삭제 차량',inDate:'2026-10-19',outDate:'2026-10-20',status:'수리중',_deletedAt:'2026-10-19'},
 {id:'escaped',carNum:'<img src=x onerror=alert(1)>',inDate:'2026-10-20',outDate:'2026-10-23',status:'수리중'}
];
const source=JSON.stringify(fixtures),model=build(fixtures);
assert(validDate('2024-02-29'));assert(!validDate('2026-02-29'));assert(!validDate('2026-13-01'));
assert.equal(model.events.filter(e=>e.kind==='out').length,2);
assert.equal(model.events.filter(e=>e.kind==='plan').length,2);
assert.equal(model.events.filter(e=>e.record.id==='deleted').length,0);
assert.equal(model.events.filter(e=>e.record.carNum==='123가1234').length,4);
assert.equal(model.missingOut,1);assert.equal(model.undated,1);assert.equal(model.active,3);
const changed=structuredClone(fixtures);changed[1].status='출고';changed[1].outDate='2026-10-24';
assert(!build(changed).events.some(e=>e.record.id==='return'&&e.kind==='plan'));
assert(build(changed).events.some(e=>e.record.id==='return'&&e.kind==='out'&&e.date==='2026-10-24'));
assert.equal(JSON.stringify(fixtures),source);
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../outputs');
const moduleSource=fs.readFileSync(path.join(root,'un/app-module.js'),'utf8'),pages=fs.readFileSync(path.join(root,'un/app-pages.js'),'utf8');
const roles=moduleSource.slice(moduleSource.indexOf('  const ROLE_MENUS ='),moduleSource.indexOf("  // 'blacklist' 페이지"));
const bridge=moduleSource.slice(moduleSource.indexOf('  window.KgmOpsCalendarBridge ='),moduleSource.indexOf('  // Isolated guide bridge'));
const switching=pages.slice(pages.indexOf('  function switchPage('),pages.indexOf('  function toggleOpsNav'));
const fixtureScript=`window._userRole=new URLSearchParams(location.search).get('role')||'admin';window._userEmail='fixture@example.test';function showNotif(){};window.KgmSafety={date:()=> '2026-10-19'};window.records=Object.fromEntries(${JSON.stringify(fixtures)}.filter(r=>!r._deletedAt).map(r=>[r.id,r]));window._openModal=id=>window.editedId=id;${roles}${bridge}${switching}document.querySelectorAll('.nav-tab').forEach(t=>{const p=t.getAttribute('onclick')?.match(/switchPage\\('(.+?)'\\)/)?.[1];if(p)t.style.display=ROLE_MENUS[window._userRole].includes(p)?'':'none';});for(const id of ['loadingScreen','loginScreen'])document.getElementById(id)?.remove();document.body.style.overflow='';`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixtureScript);}
 if(url.pathname==='/un/'){
  const html=fs.readFileSync(path.join(root,'un/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*href="https:[^>]*>/gi,'').replace('</body>','<script src="/fixture.js"></script><script src="app-ops-calendar.js"></script></body>');
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
 }
 const f=path.resolve(root,'.'+url.pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(f));
});
(async()=>{
 const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
  await page.route('https://**/*',r=>r.abort());
  const base='http://127.0.0.1:'+server.address().port+'/un/';await page.goto(base);
  await page.evaluate(()=>switchPage('opscalendar'));assert(await page.locator('#page-opscalendar').isVisible());
  assert.deepEqual(await page.locator('.oc-stat strong').allTextContents(),['4대','2대','2대','3대']);
  assert.equal(await page.locator('#oc-list .oc-record').count(),3);
  await page.locator('[data-day="2026-10-23"]').click();assert.equal(await page.locator('#oc-list .oc-record').count(),2);
  assert.equal(await page.locator('#oc-list img').count(),0);
  await page.locator('[data-edit="return"]').click();assert.equal(await page.evaluate(()=>window.editedId),'return');
  await page.locator('#oc-search').fill('123가');assert.equal(await page.locator('#oc-list .oc-record').count(),1);
  assert.deepEqual(await page.locator('.oc-stat strong').allTextContents(),['4대','2대','2대','3대']);
  await page.locator('#oc-filter').selectOption('out');assert.equal(await page.locator('#oc-list .oc-record').count(),0);
  await page.locator('#oc-search').fill('');await page.locator('#oc-filter').selectOption('all');
  await page.locator('#oc-month').fill('2024-02');assert.equal(await page.locator('[data-day]').count(),29);
  await page.locator('#oc-month').fill('2026-12');await page.locator('[data-shift="1"]').click();assert.equal(await page.locator('#oc-month').inputValue(),'2027-01');
  await page.locator('[data-today]').click();
  await page.evaluate(()=>{window.records.return.status='출고';window.records.return.outDate='2026-10-24';window._renderOpsCalendar();});
  assert.deepEqual(await page.locator('.oc-stat strong').allTextContents(),['4대','3대','1대','2대']);
  for(const width of [390,844,1440]){await page.setViewportSize({width,height:1100});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);await page.screenshot({path:path.join(out,'ops-calendar-'+width+'.png'),fullPage:true});}
  for(const role of ['staff','viewer']){await page.goto(base+'?role='+role);assert(await page.locator('#tab-opscalendar').isHidden());await page.evaluate(()=>{switchPage('opscalendar');window._renderOpsCalendar();});assert(await page.locator('#page-opscalendar').isHidden());assert.equal(await page.evaluate(()=>window.KgmOpsCalendarBridge.getRecords().length),0);}
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('PASS calendar: monthly totals, readmission IDs, actual/planned transitions, missing dates, leap/year boundaries, search/filter, existing form routing, safe text, role guards, no writes, responsive 390/844/1440');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
