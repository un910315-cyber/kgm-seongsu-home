/* Hire-anniversary balances and independent calendar-year reporting. No writes. */
(function(root){
'use strict';
function iso(d){return d.toISOString().slice(0,10);}
function day(s){return new Date(s+'T00:00:00Z');}
function valid(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(day(s).getTime()) && iso(day(s))===s;}
function today(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
// 우주항공청·한국천문연구원 월력요항 기준. 임시공휴일을 포함해 매년 갱신한다.
var HOLIDAYS={
  '2025':new Set(['2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-03-01','2025-03-03','2025-05-05','2025-05-06','2025-06-06','2025-08-15','2025-10-03','2025-10-05','2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-12-25']),
  '2026':new Set(['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02','2026-05-05','2026-05-24','2026-05-25','2026-06-03','2026-06-06','2026-08-15','2026-08-17','2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-05','2026-10-09','2026-12-25']),
  '2027':new Set(['2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-03-01','2027-05-01','2027-05-03','2027-05-05','2027-05-13','2027-06-06','2027-07-17','2027-07-19','2027-08-15','2027-08-16','2027-09-14','2027-09-15','2027-09-16','2027-10-03','2027-10-04','2027-10-09','2027-10-11','2027-12-25','2027-12-27'])
};
function hasHolidayData(year){return !!HOLIDAYS[String(year||'')];}
function isHoliday(s){return valid(s)&&hasHolidayData(s.slice(0,4))&&HOLIDAYS[s.slice(0,4)].has(s);}
function isWeekend(s){if(!valid(s))return false;var n=day(s).getUTCDay();return n===0||n===6;}
function isChargeableDate(s){return valid(s)&&!isWeekend(s)&&!isHoliday(s);}
function businessDates(start,end){
  if(!valid(start)||!valid(end)||end<start)return [];
  var years=[];for(var y=Number(start.slice(0,4));y<=Number(end.slice(0,4));y++)if(!hasHolidayData(y))years.push(y);
  if(years.length)throw Error(years.join(', ')+'년 공휴일 자료가 아직 등록되지 않았습니다. 관리자에게 문의해주세요.');
  var out=[],cur=day(start),last=day(end),guard=0;
  while(cur<=last&&guard<400){var s=iso(cur);if(isChargeableDate(s))out.push(s);cur.setUTCDate(cur.getUTCDate()+1);guard++;}
  return out;
}
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
function hours(u){if(!u||!isChargeableDate(u.date))return 0;if(u.type==='연차')return 8;if(u.type==='오전반차'||u.type==='오후반차')return 4;if(u.type==='조퇴'||u.type==='외출')return Number(u.hours)||0;return 0;}
function stats(rows){return rows.reduce(function(a,u){if(!u||!isChargeableDate(u.date))return a;if(u.type==='연차')a.annual++;if(u.type==='오전반차'||u.type==='오후반차')a.half++;if(u.type==='조퇴'||u.type==='외출')a.etc++;a.hours+=hours(u);return a;},{annual:0,half:0,etc:0,hours:0});}
var api={period:period,inPeriod:inPeriod,hours:hours,stats:stats,today:today,hasHolidayData:hasHolidayData,isHoliday:isHoliday,isWeekend:isWeekend,isChargeableDate:isChargeableDate,businessDates:businessDates};
root.KgmLeave=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
