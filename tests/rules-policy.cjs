'use strict';
const assert=require('node:assert/strict'),vm=require('vm');
const {rules}=require('../tools/backup/build-rules.cjs');
function at(root,path){return path.reduce((v,k)=>v&&v[k],root);}
class Snap{constructor(root,path=[]){this.root=root;this.path=path;}val(){return at(this.root,this.path)??null;}exists(){return this.val()!=null;}child(p){return new Snap(this.root,this.path.concat(String(p).split('/')));}parent(){return new Snap(this.root,this.path.slice(0,-1));}}
const base={allowedEmails:{'admin@test':'admin','staff@test':'staff','rep@test':'viewer','manager@test':'viewer'},leaveAccess:{'staff@test':'staff','rep@test':'rep','manager@test':'manager'},leaveEmployees:{staff:{team:'A',position:'일반'},rep:{team:'대표',position:'대표'},manager:{team:'B',position:'부서장'}},leaveRequests:{r:{empId:'staff',type:'연차',date:'2026-09-12',requestedBy:'staff@test',status:'pending_director'}},leaveUsage:{},records:{car:{carNum:'테스트',status:'입고'}}};
function check(node,path,email,after,readOnly=false){
 const current=structuredClone(base),next=after||structuredClone(base),rule=rules[node];
 const target=path?[node,path]:[node];
 const expr=readOnly?rule['.read']:(rule['.write']||rule.$id['.write']);
 const ctx={root:new Snap(current),data:new Snap(current,target),newData:new Snap(next,target),auth:email?{token:{email}}:null,now:Date.now(),$id:path};
 vm.createContext(ctx);vm.runInContext('String.prototype.beginsWith=String.prototype.startsWith',ctx);
 if(!vm.runInContext(expr,ctx))return false;
 if(!readOnly&&rule.$id&&rule.$id['.validate']&&new Snap(next,target).exists())return !!vm.runInContext(rule.$id['.validate'],ctx);
 return true;
}
assert(!check('records',null,null,null,true));assert(!check('records',null,'outsider@test',null,true));assert(check('records',null,'staff@test',null,true));
assert(!check('leaveEmployees',null,'staff@test'));assert(check('leaveEmployees',null,'admin@test'));
let locked=structuredClone(base);locked.leaveRequests.r._approvalLock={by:'rep@test',token:'t',until:Date.now()+120000};
assert(check('leaveRequests','r','rep@test',locked));assert(!check('leaveRequests','r','staff@test',locked));
let partial=structuredClone(base);Object.assign(partial.leaveRequests.r,{status:'approved',approvedBy:'rep@test',finalUsageId:'r_2026-09-12'});
assert(!check('leaveRequests','r','rep@test',partial));
let full=structuredClone(partial);full.leaveUsage['r_2026-09-12']={fromRequestId:'r',empId:'staff',type:'연차',date:'2026-09-12'};
assert(check('leaveRequests','r','rep@test',full));assert(check('leaveUsage','r_2026-09-12','rep@test',full));assert(!check('leaveUsage','r_2026-09-12','staff@test',full));
let trash=structuredClone(base);trash.records.car._deletedAt='now';assert(!check('records','car','staff@test',trash));assert(check('records','car','admin@test',trash));
base.leaveRequests.r.status='pending_manager';let wrongTeam=structuredClone(base);wrongTeam.leaveRequests.r.status='pending_admin';assert(!check('leaveRequests','r','manager@test',wrongTeam));
base.leaveEmployees.manager.team='A';assert(check('leaveRequests','r','manager@test',wrongTeam));
// 거래처 공개 범위는 저장 위치로 나뉘고 규칙이 읽기를 막는다. 연락처 쓰기는 관리자만.
assert(check('vendorContacts',null,'rep@test',null,true));
assert(!check('vendorContactsStaff',null,'rep@test',null,true));assert(check('vendorContactsStaff',null,'staff@test',null,true));
assert(!check('vendorContactsAdmin',null,'staff@test',null,true));assert(check('vendorContactsAdmin',null,'admin@test',null,true));
const vendor=(node,visibility)=>{const next=structuredClone(base);next[node]={v:{name:'거래처',phone:'010',visibility}};return next;};
assert(!check('vendorContacts','v','staff@test',vendor('vendorContacts','all')));assert(check('vendorContacts','v','admin@test',vendor('vendorContacts','all')));
assert(!check('vendorContacts','v','admin@test',vendor('vendorContacts','admin')),'admin-only vendor must not land in the public list');
assert(check('vendorContactsAdmin','v','admin@test',vendor('vendorContactsAdmin','admin')));assert(!check('vendorContactsAdmin','v','admin@test',vendor('vendorContactsAdmin','all')));
assert(check('vendorContactsStaff','v','admin@test',vendor('vendorContactsStaff','staff')));assert(!check('vendorContactsStaff','v','staff@test',vendor('vendorContactsStaff','staff')));
const ins=structuredClone(base);ins.insuranceContacts={i:{company:'보험사'}};assert(!check('insuranceContacts','i','staff@test',ins));assert(check('insuranceContacts','i','admin@test',ins));
// 매출·보증금·KGM 대수·월 목표·보험 미결은 관리자만 읽고 쓴다. 권한 표는 관리자만 읽는다.
for(const key of ['salesDaily','monthlyDeposit','kgmDailyCount','monthlyTarget','aosClaims']){
 assert(!check(key,null,'staff@test',null,true),key+' read');assert(check(key,null,'admin@test',null,true),key+' admin read');
 const next=structuredClone(base);next[key]={'2026-10-24':1};assert(!check(key,null,'staff@test',next),key+' write');assert(check(key,null,'admin@test',next),key+' admin write');
}
// 견적검색 공임표: 관리자·Staff 1단계만 읽고, 올리기는 관리자만.
assert(!check('laborCodes',null,null,null,true));assert(!check('laborCodes',null,'outsider@test',null,true));
assert(!check('laborCodes',null,'rep@test',null,true),'viewer cannot read labor codes');assert(check('laborCodes',null,'staff@test',null,true));assert(check('laborCodes',null,'admin@test',null,true));
const labor=structuredClone(base);labor.laborCodes={meta:{count:1},chunks:['0001\t작업']};
assert(!check('laborCodes',null,'staff@test',labor),'staff cannot replace labor codes');assert(check('laborCodes',null,'admin@test',labor));
assert(!check('allowedEmails',null,'staff@test',null,true));assert(check('allowedEmails',null,'admin@test',null,true));
assert(!check('leaveAccess',null,'rep@test',null,true));assert(check('leaveAccess',null,'admin@test',null,true));
// 게시판: 본인 이름으로만 쓰고, 남의 글은 지우지 못한다 (관리자는 가능)
const post=(email)=>{const s=structuredClone(base);s.board={p:{text:'메모',authorEmail:email}};return s;};
assert(check('board','p','staff@test',post('staff@test')),'own post');
assert(!check('board','p','staff@test',post('admin@test')),'cannot post as someone else');
const withPost=structuredClone(base);withPost.board={p:{text:'메모',authorEmail:'rep@test'}};
const removed=structuredClone(withPost);delete removed.board.p;
const checkFrom=(email,before,after)=>{const saved=structuredClone(base);Object.keys(base).forEach(k=>delete base[k]);Object.assign(base,before);try{return check('board','p',email,after);}finally{Object.keys(base).forEach(k=>delete base[k]);Object.assign(base,saved);}};
assert(!checkFrom('staff@test',withPost,removed),'cannot delete another person post');
assert(checkFrom('rep@test',withPost,removed),'can delete own post');
assert(checkFrom('admin@test',withPost,removed),'admin can delete any post');
console.log('PASS: approved membership, admin data controls, approver roles/teams, atomic approval rules, usage protection, trash permissions, vendor visibility by location, admin-only contact writes, admin-only sales/claims data, staff+ labor codes with admin-only upload,private permission tables, own board posts');
