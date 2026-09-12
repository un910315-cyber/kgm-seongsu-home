/* Shared business-date and conflict checks; no Firebase side effects. */
(function(root){
'use strict';
function date(value) {
  if (typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  var d=value==null?new Date():new Date(value);
  if (!Number.isFinite(d.getTime())) throw Error('날짜를 확인해주세요.');
  return new Date(d.getTime()+9*60*60*1000).toISOString().slice(0,10);
}
function equal(a,b){return JSON.stringify(a==null?null:a)===JSON.stringify(b==null?null:b);}
function object(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function diff(before,after,path,out){
  path=path||[];out=out||[];
  if(equal(before,after))return out;
  if(object(before)&&object(after)){
    Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).forEach(function(k){diff(before[k],after[k],path.concat(k),out);});
  }else out.push({path:path,before:before==null?null:before,after:after==null?null:after});
  return out;
}
function merge(current,changes){
  var next=JSON.parse(JSON.stringify(current||{}));
  for(var change of changes){
    var cursor=next;
    for(var i=0;i<change.path.length-1;i++){
      var key=change.path[i];if(!object(cursor[key]))cursor[key]={};cursor=cursor[key];
    }
    var last=change.path[change.path.length-1];
    if(!change.path.length){
      if(!equal(next,change.before)&&!equal(next,change.after))throw Error('다른 사용자가 먼저 변경했습니다. 새로 확인한 뒤 저장해주세요.');
      next=change.after||{};continue;
    }
    if(!equal(cursor[last],change.before)&&!equal(cursor[last],change.after))throw Error('다른 사용자가 같은 항목을 변경했습니다. 다시 열어 확인해주세요.');
    if(change.after===null)delete cursor[last];else cursor[last]=change.after;
  }
  return next;
}
function leaveYear(entry,year){return String(entry.date||'').slice(0,4)===String(year||date().slice(0,4));}
root.KgmSafety={date:date,equal:equal,diff:diff,merge:merge,leaveYear:leaveYear};
if(typeof module!=='undefined'&&module.exports)module.exports=root.KgmSafety;
})(typeof window!=='undefined'?window:globalThis);
