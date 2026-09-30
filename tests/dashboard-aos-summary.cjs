'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 let html=fs.readFileSync('un/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
 await page.setContent(html);
 await page.evaluate(css=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);},fs.readFileSync('un/styles.css','utf8')+'\n'+fs.readFileSync('un/design-refresh.css','utf8'));
 await page.evaluate(()=>{['loadingScreen','loginScreen'].forEach(id=>document.getElementById(id)?.remove());document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));document.getElementById('page-dashboard').classList.add('active');document.body.dataset.page='dashboard';const strip=document.getElementById('dashAosStrip');strip.style.display='';document.getElementById('das-total').textContent='₩1.2억';document.getElementById('das-kgm-amt').textContent='₩5,000만';document.getElementById('das-other-amt').textContent='₩6,000만';document.getElementById('das-open-amt').textContent='₩1,000만';});
 assert.equal(await page.locator('#dasChart').count(),0,'recent payment chart must stay removed');
 assert.equal(await page.locator('.das-cat').count(),3);
 assert.equal(await page.locator('#das-summary-note').count(),1);
 assert.deepEqual(await page.locator('.das-cat-name').allTextContents(),['KGM','타사차','오픈링크']);
 for(const width of [390,844,1366]){
  await page.setViewportSize({width,height:1000});
  const info=await page.locator('#dashAosStrip').evaluate(el=>({right:el.getBoundingClientRect().right,left:el.getBoundingClientRect().left,cols:getComputedStyle(el.querySelector('.das-cats')).gridTemplateColumns,top:el.getBoundingClientRect().top,opsBottom:document.querySelector('.dashboard-ops-card').getBoundingClientRect().bottom}));
  assert(info.left>=-1&&info.right<=width+2,JSON.stringify({width,info}));
  assert(info.top>=info.opsBottom-1,'summary must be after dashboard cards');
  const count=info.cols.split(' ').length;
  assert.equal(count,width<=900?1:3,'column count '+width);
 }
 await browser.close();console.log('PASS: KGM/타사차/오픈링크 summary, no recent-payment chart, dashboard-bottom placement, responsive 1/3 columns');
})().catch(e=>{console.error(e);process.exit(1)});
