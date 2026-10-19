(function(root){
 'use strict';
 const labels={in:'입고',out:'출고',plan:'출고 예정'};
 function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
 }
 function build(records){
  const events=[];let missingIn=0,missingOut=0,undated=0,active=0;
  for(const r of records){
   if(r._deletedAt)continue;
   const closed=r.status==='출고'||r.status==='미수리 출고';
   if(validDate(r.inDate))events.push({kind:'in',date:r.inDate,record:r});else missingIn++;
   if(!closed)active++;
   if(validDate(r.outDate))events.push({kind:closed?'out':'plan',date:r.outDate,record:r});
   else if(closed)missingOut++;else undated++;
  }
  return {events,missingIn,missingOut,undated,active};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={build,validDate};
 if(!root.document)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>root.KgmSafety.date();
 let month='',selected='',filter='all',query='',bound=false;
 const el=id=>document.getElementById(id);
 function permitted(){return root._userRole==='admin';}
 function render(){
  const host=el('oc-root');if(!host)return;
  if(!permitted()){host.innerHTML='';return;}
  if(!month){month=today().slice(0,7);selected=today();}
  if(!bound){bind(host);bound=true;}
  const records=root.KgmOpsCalendarBridge?.getRecords()||[],data=build(records);
  const monthly=data.events.filter(e=>e.date.startsWith(month));
  const count=k=>monthly.filter(e=>e.kind===k).length;
  const unrepaired=monthly.filter(e=>e.kind==='out'&&e.record.status==='미수리 출고').length;
  const visible=monthly.filter(e=>(filter==='all'||e.kind===filter)&&(!query||[e.record.carNum,e.record.carModel,e.record.name].some(v=>String(v||'').toLowerCase().includes(query))));
  const [year,mon]=month.split('-').map(Number),start=new Date(Date.UTC(year,mon-1,1)).getUTCDay(),days=new Date(Date.UTC(year,mon,0)).getUTCDate();
  const cells=[];
  for(let i=0;i<Math.ceil((start+days)/7)*7;i++){
   const n=i-start+1;if(n<1||n>days){cells.push('<div class="oc-day oc-blank" aria-hidden="true"></div>');continue;}
   const date=month+'-'+String(n).padStart(2,'0'),items=visible.filter(e=>e.date===date);
   const badges=Object.keys(labels).map(k=>{const list=items.filter(e=>e.kind===k);return list.length?'<span class="oc-chip oc-'+k+'">'+labels[k]+' <b>'+list.length+'</b></span>':'';}).join('');
   cells.push('<button type="button" class="oc-day'+(date===selected?' oc-selected':'')+(date===today()?' oc-today':'')+'" data-day="'+date+'" aria-pressed="'+(date===selected)+'" aria-label="'+date+' '+esc(items.map(e=>labels[e.kind]+' '+e.record.carNum).join(', ')||'일정 없음')+'"><span class="oc-day-number">'+n+(date===today()?'<small>오늘</small>':'')+'</span><span class="oc-day-counts">'+badges+'</span><span class="oc-car-peek">'+items.slice(0,2).map(e=>esc(e.record.carNum)).join('<br>')+(items.length>2?'<br>외 '+(items.length-2)+'건':'')+'</span></button>');
  }
  const list=visible.filter(e=>e.date===selected).sort((a,b)=>a.kind.localeCompare(b.kind)||String(a.record.carNum).localeCompare(String(b.record.carNum)));
  const rows=list.map(e=>'<article class="oc-record"><span class="oc-chip oc-'+e.kind+'">'+labels[e.kind]+'</span><div><strong>'+esc(e.record.carNum)+'</strong><p>'+esc([e.record.carModel,e.record.name,e.record.status].filter(Boolean).join(' · '))+'</p></div><button type="button" class="btn btn-ghost btn-sm" data-edit="'+esc(e.record.id)+'">차량 / 일정 수정</button></article>').join('');
  // Keep the toolbar nodes stable so typing and keyboard focus are not interrupted.
  if(!el('oc-month'))host.innerHTML='<div class="oc-summary" id="oc-summary"></div><div class="oc-toolbar"><div class="oc-month-nav"><button type="button" class="btn btn-ghost" data-shift="-1" aria-label="이전 달">‹</button><input type="month" id="oc-month" min="1900-01" max="2199-12" aria-label="조회 월"><button type="button" class="btn btn-ghost" data-shift="1" aria-label="다음 달">›</button><button type="button" class="btn btn-ghost" data-today>이번 달</button></div><input type="search" class="form-input" id="oc-search" placeholder="차량번호 · 차종 · 고객명 검색" aria-label="달력 차량 검색"><select class="form-select" id="oc-filter" aria-label="일정 구분"><option value="all">전체 일정</option><option value="in">입고</option><option value="out">출고</option><option value="plan">출고 예정</option></select></div><div class="oc-layout"><section class="oc-calendar" aria-label="월간 입출고 달력"><div class="oc-week">'+['일','월','화','수','목','금','토'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="oc-grid" id="oc-grid"></div></section><section class="oc-detail"><div class="oc-detail-heading"><h3 id="oc-day-title"></h3><span id="oc-day-total"></span></div><div id="oc-list"></div></section></div><p class="oc-note" id="oc-note"></p>';
  el('oc-month').value=month;
  el('oc-summary').innerHTML=[['월간 입고',count('in'),'입고일 기준','in'],['월간 출고',count('out'),'미수리 출고 '+unrepaired+'대 포함','out'],['월간 출고 예정',count('plan'),'아직 출고하지 않은 차량','plan'],['현재 입고 중',data.active,'전체 기간 · 현재 상태 기준','active']].map(v=>'<article class="oc-stat oc-'+v[3]+'"><span>'+v[0]+'</span><strong>'+v[1]+'<small>대</small></strong><p>'+v[2]+'</p></article>').join('');
  const focused=host.querySelector('[data-day]:focus')?.dataset.day;
  el('oc-grid').innerHTML=cells.join('');
  el('oc-day-title').textContent=selected.replace(/-/g,'.');el('oc-day-total').textContent=list.length+'건';
  el('oc-list').innerHTML=rows||'<p class="oc-empty">'+(query||filter!=='all'?'조건에 맞는 차량이 없습니다.':'이 날짜에 등록된 일정이 없습니다.')+'</p>';
  el('oc-note').textContent='입출고 목록 기준 자동 집계 · 상단 실적은 검색·필터와 관계없이 선택한 월 전체 기준입니다.'+(data.undated?' 현재 출고일 미정 '+data.undated+'대.':'')+(data.missingIn||data.missingOut?' 날짜 누락: 입고 '+data.missingIn+'건 / 출고 '+data.missingOut+'건 (해당 날짜 집계 제외).':'');
  if(focused)host.querySelector('[data-day="'+focused+'"]')?.focus({preventScroll:true});
 }
 function setMonth(value){if(!/^\d{4}-\d{2}$/.test(value)||!validDate(value+'-01')||value<'1900-01'||value>'2199-12')return;month=value;selected=value===today().slice(0,7)?today():value+'-01';render();}
 function bind(host){
  host.addEventListener('click',e=>{
   if(!permitted())return;
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.day){selected=b.dataset.day;render();}
   else if(b.dataset.shift){const [y,m]=month.split('-').map(Number);setMonth(new Date(Date.UTC(y,m-1+Number(b.dataset.shift),1)).toISOString().slice(0,7));}
   else if(b.hasAttribute('data-today'))setMonth(today().slice(0,7));
   else if(b.dataset.edit)root._openModal?.(b.dataset.edit);
  });
  host.addEventListener('change',e=>{if(!permitted())return;if(e.target.id==='oc-month')setMonth(e.target.value);if(e.target.id==='oc-filter'){filter=e.target.value;render();}});
  host.addEventListener('input',e=>{if(permitted()&&e.target.id==='oc-search'){query=e.target.value.trim().toLowerCase();render();}});
 }
 root._renderOpsCalendar=render;
})(typeof window!=='undefined'?window:globalThis);
