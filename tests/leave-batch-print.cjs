'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('un/app-module.js','utf8');
const forms=source.slice(source.indexOf('  function findEmpNameByEmail('),source.indexOf('  var _currentPrintReqId'));
const batch=source.slice(source.indexOf('  function getApprovedRequestsForBatchPrint('),source.indexOf('  function renderOrgChart('));
(async()=>{
 let html='',opens=0,prints=0,blocked=false,alerts=[];
 const requests={
  a:{empId:'e',status:'approved',createdAt:'2026-09-01',type:'연차',date:'2026-09-28',reason:'<test>',directorApprovedBy:'boss@example.test'},
  b:{empId:'e',status:'approved',createdAt:'2026-09-02',type:'오전반차',date:'2026-09-29',reason:'개인 사유'},
  c:{empId:'e',status:'approved',adminAcknowledged:true},
  d:{empId:'e',status:'pending_director'},f:{status:'rejected'}
 };
 const original=JSON.stringify(requests);
 const context={window:{_userRole:'admin',open:()=>{opens++;return blocked?null:{document:{write:s=>html=s,close:()=>{}},focus:()=>{},print:()=>prints++};}},leaveRequests:requests,leaveEmployees:{e:{name:'테스트 직원',team:'기능부'},boss:{email:'boss@example.test',name:'테스트 대표'}},showNotif:s=>alerts.push(s),setTimeout:fn=>fn(),esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};
 vm.createContext(context);vm.runInContext(forms+batch,context);
 context.window._printApprovedRequests();await Promise.resolve();
 assert.equal(opens,1);assert.equal(prints,1);assert.equal((html.match(/class="request-sheet"/g)||[]).length,2);assert(html.includes('&lt;test&gt;'));assert(html.includes('테스트 대표'));assert.equal(JSON.stringify(requests),original);
 const goodHTML=html;context.window._userRole='staff';context.window._printApprovedRequests();assert.equal(opens,1);
 context.window._userRole='admin';blocked=true;context.window._printApprovedRequests();assert(alerts.pop().includes('팝업'));
 context.leaveRequests={};context.window._printApprovedRequests();assert(alerts.pop().includes('없습니다'));
 const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:673,height:986}});
 await page.setContent(goodHTML);await page.emulateMedia({media:'print'});
 const sizes=await page.locator('.request-sheet').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,after:getComputedStyle(e).breakAfter,overflow:e.scrollWidth>e.clientWidth})));
 assert.equal(sizes.length,2);assert.equal(sizes[0].after,'page');assert.equal(sizes[1].after,'auto');
 sizes.forEach(s=>{assert(s.height<986);assert.equal(s.overflow,false)});
 assert.equal(await page.locator('.print-tools').evaluate(e=>getComputedStyle(e).display),'none');
 await browser.close();console.log('PASS: approved/unacknowledged only, role guard, empty/blocked popup, original form, escaped text, no state changes, A4-sized print layout/page breaks');
})().catch(e=>{console.error(e);process.exit(1)});
