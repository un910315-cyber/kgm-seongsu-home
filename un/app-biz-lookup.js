// 사업자 조회: 국세청 상태조회 결과(과세유형·휴폐업)를 보여 준다. 조회 전용이며 발급 기능은 없다.
// 인증키는 서버 함수(kgmBizLookup)의 Secret Manager에만 있다. 이 파일에는 키가 없다.
(function(){
 'use strict';
 const API='https://asia-northeast3-unmotors.cloudfunctions.net/kgmBizLookup';
 const $=id=>document.getElementById(id);
 const fmt=b=>String(b).replace(/\D/g,'').slice(0,10).replace(/^(\d{3})(\d{2})(\d{0,5})$/,(m,a,c,d)=>d?a+'-'+c+'-'+d:m).replace(/^(\d{3})(\d{1,2})$/,'$1-$2');
 let last=null,busy=false;
 function show(html){const box=$('bizResult');if(box)box.innerHTML=html;}
 function row(k,v){return v?'<div class="biz-row"><span>'+window.esc(k)+'</span><b>'+window.esc(v)+'</b></div>':'';}
 function render(r){
  last=r;
  if(!r.registered){show('<div class="biz-card biz-warn"><div class="biz-title">'+window.esc(fmt(r.bno))+'</div><p>'+window.esc(r.note)+'</p></div>');return;}
  const bad=r.stateCode!=='01',simple=r.taxTypeCode==='02'||r.taxTypeCode==='07';
  show('<div class="biz-card'+(bad?' biz-warn':'')+'"><div class="biz-title">'+window.esc(fmt(r.bno))+'</div>'
   +'<div class="biz-badges"><span class="biz-badge'+(simple?' biz-simple':'')+'">'+window.esc(r.taxType)+'</span><span class="biz-badge'+(bad?' biz-bad':'')+'">'+window.esc(r.state)+'</span></div>'
   +row('폐업일',r.closedDate)+row('과세유형 변경일',r.taxTypeChangedDate)+row('세금계산서 적용일',r.invoiceApplyDate)
   +'<div class="biz-actions"><button type="button" class="btn btn-ghost btn-sm" id="bizCopyBtn">결과 복사</button></div>'
   +'<p class="biz-note">국세청 상태조회 결과입니다. 상호·대표자·주소는 제공되지 않으니 사업자등록증으로 확인하세요. 세금계산서는 홈택스에서 발급합니다.</p></div>');
 }
 async function run(){
  if(busy)return;
  if(!window._requireRole||!window._requireRole('admin','staff'))return;
  const bno=String($('bizInput').value||'').replace(/\D/g,'');
  if(bno.length!==10){show('<div class="biz-card biz-warn"><p>사업자등록번호 10자리를 입력해주세요.</p></div>');return;}
  busy=true;$('bizBtn').disabled=true;show('<div class="biz-card"><p>조회 중…</p></div>');
  try{
   const token=await window._getIdToken();
   const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({bno})});
   const json=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(json.error||'조회에 실패했습니다.');
   render(json);
  }catch(e){show('<div class="biz-card biz-warn"><p>'+window.esc(e.message||'조회에 실패했습니다.')+'</p></div>');}
  finally{busy=false;$('bizBtn').disabled=false;}
 }
 function copy(){
  if(!last)return;
  const text=[fmt(last.bno),last.taxType,last.state+(last.closedDate?' ('+last.closedDate+')':'')].join(' / ');
  (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(()=>window.showNotif&&window.showNotif('복사했습니다.'),()=>window.showNotif&&window.showNotif('복사하지 못했습니다.',true));
 }
 window._mountBizLookup=function(){if(!window._canAccessPage||!window._canAccessPage('bizlookup'))return;const i=$('bizInput');if(i)setTimeout(()=>i.focus(),50);};
 if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
  const input=$('bizInput');if(!input)return;
  input.addEventListener('input',()=>{input.value=fmt(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter')run();});
  $('bizBtn').addEventListener('click',run);
  $('bizResult').addEventListener('click',e=>{if(e.target.id==='bizCopyBtn')copy();});
 });
 if(typeof module!=='undefined')module.exports={fmt};
})();
