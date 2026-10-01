/* Hire-anniversary balances and independent calendar-year reporting. No writes. */
(function(root){
'use strict';
function iso(d){return d.toISOString().slice(0,10);}
function day(s){return new Date(s+'T00:00:00Z');}
function valid(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(day(s).getTime()) && iso(day(s))===s;}
function today(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
function anniversary(h,n){var d=day(h);return iso(new Date(Date.UTC(d.getUTCFullYear()+n,d.getUTCMonth(),d.getUTCDate())));}
function previous(s){var d=day(s);d.setUTCDate(d.getUTCDate()-1);return iso(d);}
function period(emp,asOf){
  asOf=asOf||today();
  var h=emp.hireDate;
  if(!valid(h)) return {start:asOf.slice(0,4)+'-01-01',end:asOf.slice(0,4)+'-12-31',total:Number(emp.totalLeave??15),missingHire:true,under1:false};
  var years=Math.max(0,Number(asOf.slice(0,4))-Number(h.slice(0,4)));
  if(anniversary(h,years)>asOf) years=Math.max(0,years-1);
  if(years===0){
    var hd=day(h),months=0;
    for(var i=1;i<=11;i++){
      var last=new Date(Date.UTC(hd.getUTCFullYear(),hd.getUTCMonth()+i+1,0)).getUTCDate();
      var due=iso(new Date(Date.UTC(hd.getUTCFullYear(),hd.getUTCMonth()+i,Math.min(hd.getUTCDate(),last))));
      if(due<=asOf) months++;
    }
    return {start:h,end:previous(anniversary(h,1)),total:months,under1:true,accrualStart:h,accrualEnd:asOf<h?h:asOf};
  }
  return {start:anniversary(h,years),end:previous(anniversary(h,years+1)),total:Math.min(15+Math.floor((years-1)/2),25),under1:false,accrualStart:anniversary(h,years-1),accrualEnd:previous(anniversary(h,years))};
}
function inPeriod(u,p){return valid(u.date)&&u.date>=p.start&&u.date<=p.end;}
function hours(u){if(u.type==='연차')return 8;if(u.type==='오전반차'||u.type==='오후반차')return 4;if(u.type==='조퇴'||u.type==='외출')return Number(u.hours)||0;return 0;}
function stats(rows){return rows.reduce(function(a,u){if(u.type==='연차')a.annual++;if(u.type==='오전반차'||u.type==='오후반차')a.half++;if(u.type==='조퇴'||u.type==='외출')a.etc++;a.hours+=hours(u);return a;},{annual:0,half:0,etc:0,hours:0});}
var api={period:period,inPeriod:inPeriod,hours:hours,stats:stats,today:today};
root.KgmLeave=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
