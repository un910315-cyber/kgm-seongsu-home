'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const safety=require('../un/app-safety.js'),source=fs.readFileSync('un/app-module.js','utf8');
function part(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
function snap(v){return {val:()=>structuredClone(v),exists:()=>v!=null};}
function read(tree,path){return path.split('/').filter(Boolean).reduce((v,k)=>v&&v[k],tree);}
function write(tree,path,val){let keys=path.split('/').filter(Boolean),last=keys.pop(),at=tree;for(const k of keys)at=at[k]||(at[k]={});if(val===null)delete at[last];else at[last]=structuredClone(val);}
async function approvalScenario({fail=false,double=false,role='director'}={}){
 let data={leaveRequests:{r:{empId:'employee',status:'pending_director',type:'연차',date:'2026-09-12',requestedBy:'employee@test'}},leaveUsage:{}};
 let notices=[],failOnce=fail;
 const ctx={window:{_userEmail:'director@test',_userRole:role==='director'?'viewer':'staff',KgmSafety:safety},console,Date,Math,Set,
 getMyEmpRecord:()=>({id:'boss',position:role==='director'?'대표':'일반'}),
 canApproveStage:(stage,me)=>stage==='pending_director'&&me.position==='대표',
 leaveEmployees:{employee:{team:'A'}},leaveRequests:structuredClone(data.leaveRequests),
 eachWeekdayInRange:()=>['2026-09-11','2026-09-14'],
 ref:(_,path='')=>path,db:{},statusLabel:s=>s,showNotif:t=>notices.push(t),
 runTransaction:async(path,fn)=>{let v=fn(structuredClone(read(data,path)));if(v===undefined)return {committed:false,snapshot:snap(read(data,path))};write(data,path,v);return {committed:true,snapshot:snap(v)};},
 update:async(_,patch)=>{if(failOnce){failOnce=false;throw Error('network');}let next=structuredClone(data);for(const [k,v]of Object.entries(patch))write(next,k,v);data=next;}
 };
 vm.createContext(ctx);
 vm.runInContext(part('  function canActOnLeave','  // ')+part('  window._approveRequest =','  window._acknowledgeRequest ='),ctx);
 if(double)await Promise.all([ctx.window._approveRequest('r'),ctx.window._approveRequest('r')]);else await ctx.window._approveRequest('r');
 if(role!=='director'){assert.equal(data.leaveRequests.r.status,'pending_director');assert.equal(Object.keys(data.leaveUsage).length,0);}
 else if(fail){assert.equal(data.leaveRequests.r.status,'pending_director');assert.equal(Object.keys(data.leaveUsage).length,0);assert.equal(data.leaveRequests.r._approvalLock,undefined);}
 else {assert.equal(data.leaveRequests.r.status,'approved');assert.equal(Object.keys(data.leaveUsage).length,1);assert.equal(data.leaveUsage['r_2026-09-12'].fromRequestId,'r');assert.equal(data.leaveRequests.r._approvalLock,undefined);}
}
async function workcodes(){
 let tree={},notices=[],render=0,opened=0;
 const elements={wcTableItemEditorTitle:{},wcTableItemSection:{},wcTableItemName:{focus(){}},wcTableItemCode:{},wcTableItemEditorModal:{classList:{add(){opened++},remove(){}}}};
 const ctx={window:{KgmSafety:safety,_renderWorkCodeTable:()=>render++},document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id]},localStorage:{setItem(){}},prompt:()=> '변경된 이름',alert:t=>notices.push(t),console,setTimeout:fn=>fn()};
 vm.createContext(ctx);
 let code=fs.readFileSync('un/app-workcodes-ui.js','utf8').replace('function init(){','window.testConnect=function(m){dbMod=m;dbRef="cfg";};function init(){');
 vm.runInContext(code,ctx);
 ctx.window.testConnect({runTransaction:async(_,fn)=>{let next=fn(structuredClone(tree));if(next===undefined)return {committed:false};tree=next;return {committed:true,snapshot:snap(tree)};},get:async()=>snap(tree)});
 let base=[{name:'앞범퍼',items:[{name:'A',code:'111'},{name:'B',code:'222'}]}];
 ctx.window._wcPrepareTableSections(base);
 await ctx.window._wcRenameTableSection(encodeURIComponent('앞범퍼'));
 let rows=ctx.window._wcPrepareTableSections(base);
 await ctx.window._wcMoveTableItem(encodeURIComponent('앞범퍼'),encodeURIComponent(rows[0].items[1]._wcKey),-1);
 rows=ctx.window._wcPrepareTableSections(base);assert.equal(rows[0].items[0].code,'222');
 ctx.window._wcEditTableItem(encodeURIComponent('앞범퍼'),encodeURIComponent(rows[0].items[0]._wcKey));
 assert.equal(opened,1);assert.equal(elements.wcTableItemSection.textContent,'변경된 이름');
}
(async()=>{
 assert.equal(safety.date('2026-09-12T08:00:00+09:00'),'2026-09-12');
 assert.equal(safety.date('2026-12-31T23:30:00-05:00'),'2027-01-01');
 assert(safety.leaveYear({date:'2026-02-01'},2026));assert(!safety.leaveYear({date:'2025-12-31'},2026));
 const delta=safety.diff({location:'1층',memo:'old'},{location:'1층',memo:'new'});
 assert.deepEqual(safety.merge({location:'도장',memo:'old'},delta),{location:'도장',memo:'new'});
 assert.throws(()=>safety.merge({location:'도장',memo:'other'},delta));
 const deletion=safety.diff({items:{a:1,b:2}},{items:{b:2}});assert.deepEqual(safety.merge({items:{a:1,b:2,c:3}},deletion),{items:{b:2,c:3}});
 await approvalScenario();await approvalScenario({double:true});await approvalScenario({fail:true});await approvalScenario({role:'staff'});
 await workcodes();
 console.log('PASS: KST/year, disjoint merge, same-field conflict, deletion merge, atomic approval, duplicate approval, failure rollback, unauthorized approval, renamed workcode edit/reorder');
})().catch(e=>{console.error(e);process.exit(1)});
