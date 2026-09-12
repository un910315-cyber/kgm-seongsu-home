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
console.log('PASS: approved membership, admin data controls, approver roles/teams, atomic approval rules, usage protection, trash permissions');
