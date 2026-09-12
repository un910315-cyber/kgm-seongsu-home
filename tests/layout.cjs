'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage();
await p.route('**/*',route=>route.abort());
let html=fs.readFileSync('un/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
await p.setContent(html);await p.evaluate(css=>{const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);},fs.readFileSync('un/styles.css','utf8'));
await p.evaluate(()=>{for(const id of ['loadingScreen','loginScreen']){const el=document.getElementById(id);if(el)el.remove();}});
for(const width of [390,844,1024,1366]){
 await p.setViewportSize({width,height:900});
 for(const name of ['list','status','complete','out']){
  await p.evaluate(name=>{document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));document.getElementById('page-'+name).classList.add('active');document.body.dataset.page=name;const row='<tr>'+['123가4567','토레스','010-0000-0000','도장','삼성','현대','앞범퍼 수리','테스트 렌트카','09.12','-','수정'].map(x=>'<td>'+x+'</td>').join('')+'</tr>';document.querySelector('#page-'+name+' tbody').innerHTML=row;},name);
  const r=await p.locator('#page-'+name+' .table-wrap').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,display:getComputedStyle(el.querySelector('tr')).display,width:innerWidth}));
  assert(r.right<=width+2,JSON.stringify({name,...r}));assert(r.left>=-1);assert.equal(r.display,'table-row');
 }
 console.log('PASS layout '+width+'px: four lists remain rows; horizontal overflow stays inside list');
}
await p.screenshot({path:'C:/Users/pc/kgm-safety-desktop.png'});
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
