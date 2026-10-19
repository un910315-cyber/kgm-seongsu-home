'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.resolve(root,'../repair-menu-qa');fs.mkdirSync(output,{recursive:true});
const moduleSource=fs.readFileSync(path.join(root,'un/app-module.js'),'utf8'),pages=fs.readFileSync(path.join(root,'un/app-pages.js'),'utf8');
const roleBlock=moduleSource.slice(moduleSource.indexOf('  const ROLE_MENUS ='),moduleSource.indexOf("  // 'blacklist' 페이지"));
const bridgeBlock=moduleSource.slice(moduleSource.indexOf('  window.KgmRepairBridge='),moduleSource.indexOf('  function recordTimeValue'));
const switchBlock=pages.slice(pages.indexOf('  function switchPage('),pages.indexOf('  function toggleOpsNav'));
const fixtures=[{id:'intake-current',carNum:'123가1234',carModel:'토레스',name:'가상 고객',phone:'01000001234',inDate:'2026-10-15',outDate:'2026-10-22',status:'수리중'},{id:'intake-old',carNum:'123가1234',carModel:'토레스',name:'가상 고객',phone:'01000001234',inDate:'2026-08-01',outDate:'2026-08-05',status:'출고'}];
const fixtureScript=`window.KGM_REPAIR_CONFIG={...window.KGM_REPAIR_CONFIG,previewOnly:true,apiBase:""};window._userRole=new URLSearchParams(location.search).get('role')||'admin';window._userEmail='fixture@local.test';window.showNotif=function(){};function showNotif(){};window.esc=s=>String(s).replace(/[&<>"']/g,'');window._tokenReads=0;const auth={currentUser:{getIdToken:()=>{window._tokenReads++;return Promise.resolve('not-used');}}};window.fixtureRecords=${JSON.stringify(fixtures)};function getList(){return structuredClone(window.fixtureRecords);}${roleBlock}${bridgeBlock}${switchBlock}document.querySelectorAll('.nav-tab').forEach(t=>{const p=t.getAttribute('onclick')?.match(/switchPage\\('(.+?)'\\)/)?.[1];if(p)t.style.display=ROLE_MENUS[window._userRole].includes(p)?'':'none';});for(const id of ['loadingScreen','loginScreen'])document.getElementById(id)?.remove();document.body.style.overflow='';`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixtures.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fixtureScript);}let rel=url.pathname.replace(/^\//,'');if(rel==='un/'||rel==='un'){
  let html=fs.readFileSync(path.join(root,'un/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*href="https:[^>]*>/gi,'');html=html.replace('</body>','<script src="repair-guide-config.js"></script><script src="/fixtures.js"></script><script src="app-repair-guide.js"></script></body>');res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
}if(rel.endsWith('/'))rel+='index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[],apiRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))apiRequests.push(r.url());});
 await page.goto(base+'/un/');await page.locator('[data-repair-entry]').click();const staff=page.frameLocator('#repairGuideFrame');await staff.locator('#rg-connection-note').waitFor({state:'visible'});assert(await staff.locator('#rg-send').isDisabled());assert(await staff.locator('#rg-manual-save').isDisabled());
 await staff.locator('#rg-search').fill('1234');assert.equal(await staff.locator('[data-admission]').first().getAttribute('data-admission'),'intake-current');await staff.locator('[data-admission="intake-current"]').click();assert.equal(await staff.locator('#rg-phone').inputValue(),'01000001234');assert.equal(await staff.locator('#rg-date').inputValue(),'2026-10-22');
 await staff.locator('#rg-upload').setInputFiles({name:'견적서.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5wAAAABJRU5ErkJggg==','base64')});await staff.locator('#rg-manual').selectOption('parts');await staff.locator('#rg-notice').fill('이 고객에게만 보낼 미리보기 안내');await staff.locator('#rg-preview').click();await staff.locator('#rg-preview-dialog').waitFor({state:'visible'});assert.match(await staff.locator('#rg-preview-body').innerText(),/이 고객에게만/);assert.match(await staff.locator('#rg-preview-body').innerText(),/2026년 10월 22일/);assert.equal(await staff.locator('#rg-preview-body [data-choice], #rg-preview-body input[type=checkbox]').count(),0);assert.equal(await staff.locator('#rg-preview-body [data-confirm]').innerText(),'확인');await staff.locator('#rg-preview-body [data-confirm]').click();assert(await staff.locator('#rg-preview-dialog').isHidden());
 await staff.locator('#rg-files [data-view]').click();assert(await staff.locator('dialog[open] img').evaluate(image=>image.complete&&image.naturalWidth>0));await staff.locator('dialog[open] > .rg-close').click();
 console.log('Image preview passed; creating PDF');const pdfPage=await browser.newPage();await pdfPage.setContent('<h1>KGM 견적서 미리보기</h1><p>PDF attachment rendered in Edge.</p><div style="break-before:page"><h1>Second page</h1></div>');const pdf=await pdfPage.pdf({timeout:10000});await pdfPage.close();
 await staff.locator('#rg-upload').setInputFiles({name:'estimate.pdf',mimeType:'application/pdf',buffer:pdf});await staff.locator('#rg-files [data-view]').click();
 const pdfCanvas=staff.locator('dialog[open] canvas[data-rendered-page="1"]');await pdfCanvas.waitFor({state:'visible',timeout:15000});assert.equal(await staff.locator('dialog[open] iframe').count(),0);assert(await pdfCanvas.evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100)ink++;return ink>100;}));
 await page.screenshot({path:path.join(output,'edge-pdf-preview.png')});await staff.getByRole('button',{name:'다음 페이지',exact:true}).click();await staff.locator('canvas[data-rendered-page="2"]').waitFor();assert.match(await staff.locator('.rg-pdf-toolbar [role="status"]').innerText(),/2 \/ 2/);await staff.getByRole('button',{name:'이전 페이지',exact:true}).click();await staff.locator('canvas[data-rendered-page="1"]').waitFor();await staff.locator('dialog[open] > .rg-close').click();
 await staff.locator('#rg-preview').click();await staff.locator('#rg-preview-body [data-file]').click();await staff.locator('dialog[open]:not(#rg-preview-dialog) canvas[data-rendered-page="1"]').waitFor();await staff.locator('dialog[open]:not(#rg-preview-dialog) > .rg-close').click();await staff.locator('#rg-preview-dialog > .rg-close').click();
 await staff.locator('[data-tab="history"]').click();assert.match(await staff.locator('#rg-history-rows').innerText(),/연결 준비 중/);await staff.locator('[data-tab="send"]').click();
 for(const width of [390,844,1366]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Parent overflow '+width);assert(await staff.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Frame overflow '+width);if(width===1366)await page.screenshot({path:path.join(output,'internal-menu-desktop.png'),fullPage:true});}
 assert.equal(await page.evaluate(()=>window._tokenReads),0);assert.deepEqual(await page.evaluate(()=>window.fixtureRecords),fixtures);assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);
 await page.goto(base+'/un/?role=viewer');assert(await page.locator('[data-repair-entry]').isHidden());await page.evaluate(()=>window._openRepairGuide('intake-current'));assert.equal(await page.locator('#repairGuideFrame').getAttribute('src'),'about:blank');
 await page.goto(base+'/un/?role=staff');assert(await page.locator('[data-repair-entry]').isHidden());await page.evaluate(()=>window._openRepairGuide('intake-current'));assert.equal(await page.locator('#repairGuideFrame').getAttribute('src'),'about:blank');
 // Mock the connected send API: never send messages or touch production records.
 await page.goto(base+'/un/');
 await page.evaluate(base=>{window.KgmRepairBridge.config={enabled:true,previewOnly:false,apiBase:base+'/mock'};},base);
 const sentPayloads=[];let releaseSend;
 await page.route('**/mock/api/staff/**',async route=>{
  const endpoint=new URL(route.request().url()).pathname.split('/').pop();
  if(endpoint==='config')return route.fulfill({json:{mode:'live',liveEnabled:true}});
  if(endpoint==='manuals')return route.fulfill({json:[{id:'standard',title:'기본 안내',body:'저장된 기본 안내문'}]});
  if(endpoint==='sends'&&route.request().method()==='POST'){
   sentPayloads.push(route.request().postDataJSON());
   await new Promise(resolve=>releaseSend=resolve);
   return route.fulfill({json:{id:'mock-send',mode:'live',delivery:'requested',link:base+'/mock-customer'}});
  }
  throw Error('Unexpected API '+endpoint);
 });
 await page.locator('[data-repair-entry]').click();
 await staff.locator('#rg-search').fill('123');await staff.locator('[data-admission="intake-current"]').click();
 await staff.locator('#rg-notice').fill('이 고객만의 안내');
 await staff.locator('#rg-upload').setInputFiles({name:'estimate.pdf',mimeType:'application/pdf',buffer:pdf});
 await staff.locator('#rg-send').click();await page.waitForFunction(()=>document.getElementById('repairGuideFrame').contentDocument.getElementById('rg-reset').disabled);
 while(!releaseSend)await new Promise(r=>setTimeout(r,10));
 assert(await staff.locator('#rg-reset').isDisabled());
 await staff.locator('#rg-reset').evaluate(b=>b.onclick());
 assert(await staff.locator('#rg-selected').isVisible());
 releaseSend();await staff.locator('#rg-sent-open').waitFor();
 await staff.locator('#rg-reset').click();
 assert(await staff.locator('#rg-selected').isHidden());
 for(const id of ['rg-search','rg-phone','rg-date','rg-upload'])assert.equal(await staff.locator('#'+id).inputValue(),'');
 assert.equal(await staff.locator('#rg-files').innerText(),'');assert.equal(await staff.locator('#rg-send-result').innerText(),'');
 assert.equal(await staff.locator('#rg-notice').inputValue(),'저장된 기본 안내문');
 assert.equal(await staff.locator('#rg-recipient').innerText(),'차량을 선택해주세요.');
 assert.equal(await page.evaluate(()=>window.KgmRepairBridge.selection),null);
 await staff.locator('#rg-send').click();assert.equal(sentPayloads.length,1);
 assert.match(await staff.locator('#staff-error').innerText(),/차량을 선택/);
 await page.evaluate(()=>window._mountRepairGuide());assert(await staff.locator('#rg-selected').isHidden());
 await staff.locator('#rg-search').fill('123');await staff.locator('[data-admission="intake-old"]').click();
 await staff.locator('#rg-upload').setInputFiles({name:'next.pdf',mimeType:'application/pdf',buffer:pdf});
 releaseSend=null;await staff.locator('#rg-send').click();while(!releaseSend)await new Promise(r=>setTimeout(r,10));
 assert.notEqual(sentPayloads[0].requestKey,sentPayloads[1].requestKey);assert.equal(sentPayloads[1].admissionId,'intake-old');
 assert.equal(sentPayloads[1].notice,'저장된 기본 안내문');assert.equal(sentPayloads[1].files[0].name,'next.pdf');
 releaseSend();await staff.locator('#rg-sent-open').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS internal menu and reset: draft cleared, default notice restored, selection cleared across menu switches, in-flight reset locked, next send uses fresh key and correct admission/files; sends mocked only');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);server.close();process.exit(1);});
