(function(global){
  'use strict';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(value+'T12:00:00+09:00')):'담당자 확인 중';
  const time=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  function message(snapshot){return global.KgmRepairMessage.text(snapshot);}
  function render(target,view,{preview=false,demo=false,onFile=()=>{},onConfirm=()=>{}}={}){
    const s=view.snapshot;
    if(parent!==window)parent.postMessage({type:'kgm-repair-focus'},location.origin);
    target.innerHTML=`<div class="rg-shell"><header class="rg-header"><strong>${escape(s.center)}</strong><div class="rg-sub">KGM SERVICE CENTER</div></header><main class="rg-body"><span class="rg-badge">${preview?'직원 미리보기 · 기록 생성 안 됨':demo?'검수용 예시 · 실제 차량 아님':'테스트 안내'}</span><h1>입고 및 수리 안내</h1><h2>${escape(s.vehicle.carNum)} · ${escape(s.vehicle.carModel)}</h2><div class="rg-sub">${escape(s.vehicle.name)} 고객님</div><section class="rg-date"><div class="rg-sub">예상 출고일</div><strong>${escape(date(s.expectedDeliveryDate))}</strong><div class="rg-sub">부품 수급과 수리 진행 상황에 따라 출고일이 달라질 수 있습니다.</div></section><h2>견적서</h2>${demo?'<div class="rg-example"><strong>견적서 예시</strong><div><span>부품</span><span>450,000원</span></div><div><span>수리 공임</span><span>750,000원</span></div><div><strong>합계 · 부가세 포함</strong><strong>1,320,000원</strong></div><p class="rg-sub">검수용 가상 견적이며 실제 고객 자료가 아닙니다.</p></div>':s.files.map(f=>`<div class="rg-file"><span>${escape(f.name)}</span><button type="button" data-file="${escape(f.id)}">견적서 보기</button></div>`).join('')}<h2>수리 안내</h2><div class="rg-copy">${escape(s.notice)}</div><div class="rg-sub" style="margin-top:18px">문의: ${escape(s.centerPhone)}</div><div class="rg-response"></div></main></div>`;
    const response=target.querySelector('.rg-response');
    response.innerHTML='<div class="rg-actions"><button type="button" class="rg-primary" data-confirm>확인</button></div>';
    const confirm=response.querySelector('[data-confirm]');
    confirm.onclick=async()=>{
      if(preview){target.closest('dialog')?.close();return;}
      if(demo){confirm.textContent='확인했습니다';return;}
      confirm.disabled=true;
      try{await onConfirm();confirm.textContent='확인했습니다';}finally{confirm.disabled=false;}
    };
    target.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>onFile(s.files.find(f=>f.id===b.dataset.file)));
  }
  const scriptUrl=global.document?.currentScript?.src;
  function showFile(file,url){
    if(parent!==window)parent.postMessage({type:'kgm-repair-focus'},location.origin);
    const dialog=document.createElement('dialog'),close=document.createElement('button');let dispose,closed=false;
    close.className='rg-close';close.textContent='닫기';dialog.append(close);
    if(file.type==='application/pdf'){
      const host=document.createElement('div'),download=document.createElement('a');host.className='rg-pdf-host';host.textContent='견적서를 불러오는 중…';
      download.href=url;download.download=file.name;download.textContent='견적서 파일 내려받기';download.className='rg-pdf-download';dialog.append(host,download);
      import(new URL('pdf-viewer.js?v=v173-2026-10-15',new URL('.',scriptUrl)).href).then(module=>{if(closed)return;host.textContent='';dispose=module.mountPdf(host,url);}).catch(()=>{if(!closed)host.textContent='미리보기를 불러오지 못했습니다. 파일을 내려받아 확인해주세요.';});
    }else{const image=document.createElement('img');image.className='rg-image';image.alt=file.name;image.src=url;dialog.append(image);}
    document.body.append(dialog);close.onclick=()=>dialog.close();dialog.onclose=()=>{closed=true;dispose?.();if(url.startsWith('blob:'))URL.revokeObjectURL(url);dialog.remove();};dialog.showModal();
  }
  global.KgmRepairUI={escape,date,time,message,render,showFile};
})(window);
