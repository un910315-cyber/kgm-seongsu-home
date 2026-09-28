'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('un/app-module.js','utf8');
const block=source.slice(source.indexOf('  // 매월 교육 안내:'),source.indexOf('  // 인증 상태 감시'));
assert(block.includes('_maybeShowMonthlyTrainingReminder'));
const html=fs.readFileSync('un/index.html','utf8');
assert(html.includes('https://ssangyong.step.or.kr/main.do'));
assert(html.includes('이번 달 다시 보지 않기'));
assert(html.includes('>닫기</button>'));
function create(opts={}){
  const values=opts.values||{},modal={open:false,classList:{add:c=>{if(c==='open')modal.open=true;},remove:c=>{if(c==='open')modal.open=false;}}};
  let busy=!!opts.busy,retries=0;
  const context={window:{_userEmail:opts.email||'user@example.com',KgmSafety:{date:()=>opts.date||'2026-09-28'}},document:{
    getElementById:id=>id==='trainingReminderModal'?modal:null,
    querySelector:()=>busy?{}:null
  },localStorage:{getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;}},setTimeout:fn=>{retries++;busy=false;fn();}};
  vm.createContext(context);vm.runInContext(block,context);
  return {context,modal,values,get retries(){return retries;}};
}
let x=create();x.context.window._maybeShowMonthlyTrainingReminder(0);assert(x.modal.open);
x.context.window._closeTrainingReminder(false);assert(!x.modal.open);assert.equal(Object.keys(x.values).length,0);
x.context.window._maybeShowMonthlyTrainingReminder(0);assert(!x.modal.open,'same page close should not reopen');
x=create();x.context.window._maybeShowMonthlyTrainingReminder(0);x.context.window._closeTrainingReminder(true);
assert.equal(x.values['kgmTrainingReminderDismissed:user@example.com'],'2026-09');
let y=create({values:x.values});y.context.window._maybeShowMonthlyTrainingReminder(0);assert(!y.modal.open,'dismissed month');
y=create({values:x.values,date:'2026-10-01'});y.context.window._maybeShowMonthlyTrainingReminder(0);assert(y.modal.open,'new month');
y=create({values:x.values,email:'other@example.com'});y.context.window._maybeShowMonthlyTrainingReminder(0);assert(y.modal.open,'per user');
y=create({busy:true});y.context.window._maybeShowMonthlyTrainingReminder(0);assert.equal(y.retries,1);assert(y.modal.open,'retry after another modal');
console.log('PASS: monthly display, close, per-user monthly dismissal, next-month reset, busy-modal retry, link and buttons');
