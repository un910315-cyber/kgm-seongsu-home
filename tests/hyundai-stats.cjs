const fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..')+'/';
const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage();
const html=fs.readFileSync(root+'un/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');await p.setContent(html);
await p.evaluate(css=>{const e=document.createElement('style');e.textContent=css;document.head.appendChild(e);},fs.readFileSync(root+'un/styles.css','utf8')+fs.readFileSync(root+'un/design-refresh.css','utf8'));
const source=fs.readFileSync(root+'un/app-module.js','utf8');const logic=source.slice(source.indexOf('  function renderStats()'),source.indexOf('  window.renderStats = renderStats;'));
await p.evaluate(logic=>{window.LOCAL_DASHBOARD_PREVIEW=false;window.renderMonthlyInsightBar=()=>{};window.data=['KGM','국산차','외산차','현대해상',''].map(carType=>({carType,inDate:'2026-10-02'}));data.push({carType:'현대해상',inDate:'2026-09-01'},{carType:'현대해상',inDate:'2025-10-01'});window.getList=()=>data;document.getElementById('statsYear').innerHTML='<option>2026</option>';document.getElementById('statsMonth').value='all';(0,eval)(logic);renderStats();},logic);
let cells=await p.locator('#stats-tfoot td').allTextContents();assert.equal(cells.length,9);assert.deepEqual(cells.slice(1,7),['1','1','1','2','1','6']);
let october=await p.locator('#stats-tbody tr').nth(9).locator('td').allTextContents();assert.deepEqual(october.slice(1,7),['1','1','1','1','1','5']);
assert.match(await p.locator('#stats-bar').innerText(),/현대해상 2대/);
await p.selectOption('#statsMonth','10');await p.evaluate(()=>renderStats());assert.match(await p.locator('#stats-bar').innerText(),/현대해상 1대/);
for(const width of [390,1366]){await p.setViewportSize({width,height:1000});assert.equal(await p.locator('#stats-tbody tr').count(),12);const box=await p.locator('#stats-tbody').evaluate(e=>{const w=e.closest('.table-wrap');return {left:w.getBoundingClientRect().left,right:w.getBoundingClientRect().right};});assert(box.left>=-1&&box.right<=width+2);}
await p.evaluate(()=>{data=[];renderStats();});assert.match(await p.locator('#stats-bar').innerText(),/데이터가 없습니다/);assert.equal((await p.locator('#stats-tfoot td').allTextContents())[4],'0');
await b.close();console.log('PASS exclusive category/month/year totals, Hyundai ratios, empty state and responsive table');
})().catch(e=>{console.error(e);process.exit(1)});
