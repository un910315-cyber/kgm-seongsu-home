'use strict';
const fs=require('fs'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 const original=cp.execFileSync('git',['show','rollback-before-design-refresh-20260912:un/index.html'],{encoding:'utf8'});
 const html=fs.readFileSync('un/index.html','utf8');
 const clean=s=>s.replaceAll('v152-2026-09-12','v151-2026-09-12').replace(/<link rel="stylesheet" href="design-refresh[^>]+>\r?\n/,'').replace(/\r\n/g,'\n');
 assert.equal(clean(html),original.replace(/\r\n/g,'\n'),'HTML functions/handlers must remain unchanged');
 await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
 await page.evaluate(css=>{let e=document.createElement('style');e.textContent=css;document.head.append(e);},fs.readFileSync('un/styles.css','utf8'));
 await page.evaluate(()=>{['loadingScreen','loginScreen'].forEach(id=>document.getElementById(id)?.remove());document.querySelectorAll('.nav-tab').forEach(e=>e.style.display='');});
 await page.emulateMedia({media:'print'});
 const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('.header,.main,.table-wrap,.modal')].map(e=>{const s=getComputedStyle(e);return [s.display,s.color,s.backgroundColor,s.width,s.fontSize]}));
 const printBefore=await snapshot();
 await page.evaluate(css=>{let e=document.createElement('style');e.textContent=css;document.head.append(e);},fs.readFileSync('un/design-refresh.css','utf8'));
 assert.deepEqual(await snapshot(),printBefore,'Print appearance must remain unchanged');
 await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>{
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));document.getElementById('page-status').classList.add('active');document.body.dataset.page='status';
  document.querySelector('#page-status tbody').innerHTML=Array.from({length:8},(_,i)=>'<tr><td><span class="car-num">123가'+(4567+i)+'</span></td><td>토레스</td><td>010-0000-0000</td><td><button class="ops-chip ops-location">1층</button></td><td><button class="ops-chip ops-status status-수리중">수리중</button></td><td>보험사</td><td>앞범퍼 교환 및 도장</td><td>테스트 렌트카</td><td>09.12</td><td>09.15</td><td><button class="btn btn-ghost">수정</button></td></tr>').join('');
 });
 for(const width of [390,844,1366]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page overflow '+width);
  await page.screenshot({animations:'disabled',path:'C:/Users/pc/kgm-design-status-'+width+'.png'});
 }
 await page.evaluate(()=>{
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));let el=document.getElementById('page-estimate');el.classList.add('active');document.body.dataset.page='estimate';
  el.innerHTML='<div class="wc-table-view"><div class="wc-table-view-head"><div><h2>작업코드표</h2><p>작업코드를 검색하고 편집할 수 있습니다.</p></div><button class="btn btn-primary">편집</button></div><input class="form-input" id="workCodeSearch" placeholder="작업내용 또는 코드 검색"><div class="wc-grid">'+['앞범퍼','앞휀더 좌','앞휀더 우','헤드램프'].map((name,i)=>'<div class="wc-card '+(i===1?'lh':i===2?'rh':'')+'"><div class="wc-card-head"><span>'+name+'</span><em>6</em></div><div class="wc-card-items">'+Array.from({length:6},(_,j)=>'<div class="wc-item"><span class="wc-item-name">'+(j===2?'헤드램프 탈부착 LH(추가) 및 부속품 점검':'앞범퍼 어퍼훼시아 탈부착')+'</span><span class="wc-item-code">'+(j===2?'5330104 / 5330101 (추가) / 5330103 (풀공임)':'8228800')+'</span></div>').join('')+'</div></div>').join('')+'</div></div>';
 });
 for(const width of [390,844,1366]){
  await page.setViewportSize({width,height:900});
  const issues=await page.locator('.wc-item').evaluateAll(items=>items.filter(e=>{const a=e.querySelector('.wc-item-name').getBoundingClientRect(),b=e.querySelector('.wc-item-code').getBoundingClientRect();return a.right>b.left+1&&a.bottom>b.top+1&&b.bottom>a.top+1}).length);
  assert.equal(issues,0,'Workcode text overlap '+width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'workcode page overflow '+width);
  await page.screenshot({animations:'disabled',path:'C:/Users/pc/kgm-design-workcodes-'+width+'.png'});
 }
 await browser.close();console.log('PASS: unchanged HTML handlers, unchanged print styles, navigation/list/workcode layouts and no text overlaps at 390/844/1366');
})().catch(e=>{console.error(e);process.exit(1)});
