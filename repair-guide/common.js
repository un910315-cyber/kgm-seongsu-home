(function(global){
  'use strict';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(value+'T12:00:00+09:00')):'담당자 확인 중';
  const time=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  function message(snapshot){return global.KgmRepairMessage.text(snapshot);}
  function render(target,view,{preview=false,demo=false,onFile=()=>{},onConfirm=()=>{}}={}){
    const s=view.snapshot;
    if(parent!==window)parent.postMessage({type:'kgm-repair-focus'},location.origin);
    const documents=demo?'<div class="rg-example"><div class="rg-document-label">견적서 예시</div><div><span>부품</span><span>450,000원</span></div><div><span>수리 공임</span><span>750,000원</span></div><div class="rg-total"><strong>합계 <small>부가세 포함</small></strong><strong>1,320,000원</strong></div><p class="rg-sub">검수용 가상 견적이며 실제 고객 자료가 아닙니다.</p></div>':s.files.map((f,i)=>`<div class="rg-file"><div class="rg-file-icon" aria-hidden="true">${f.type==='application/pdf'?'PDF':'IMG'}</div><div class="rg-file-info"><strong>견적서${s.files.length>1?' '+(i+1):''}</strong><span>${escape(f.name)}</span></div><button type="button" data-file="${escape(f.id)}">견적서 보기 <span aria-hidden="true">↗</span></button></div>`).join('');
    target.innerHTML=`<div class="rg-shell rg-customer"><header class="rg-header"><div class="rg-brand"><span class="rg-wordmark">KGM</span><span class="rg-brand-divider"></span><span>성수서비스센터</span></div><div class="rg-header-caption">SERVICE INFORMATION</div><h1>입고 및 수리 안내</h1><p>고객님의 차량, 꼼꼼하게 살피겠습니다.</p></header><main class="rg-body"><div class="rg-mode"><span class="rg-badge">${preview?'직원 미리보기 · 기록 생성 안 됨':demo?'검수용 예시 · 실제 차량 아님':view.mode==='live'?'차량 수리 안내':'테스트 안내'}</span></div><section class="rg-vehicle"><div class="rg-eyebrow">고객님의 차량</div><h2>${escape(s.vehicle.carNum)}</h2><div class="rg-vehicle-meta"><span>${escape(s.vehicle.carModel)}</span><span>${escape(s.vehicle.name)} 고객님</span></div></section><section class="rg-date"><div class="rg-date-label"><span class="rg-calendar" aria-hidden="true">▦</span> 예상 출고일</div><strong>${escape(date(s.expectedDeliveryDate))}</strong><div class="rg-sub">부품 수급과 수리 진행 상황에 따라 달라질 수 있습니다.</div></section><section class="rg-section"><div class="rg-section-title"><h2>견적서 확인</h2><span>01</span></div><p class="rg-section-intro">수리 항목과 금액을 확인해주세요.</p>${documents}</section><section class="rg-section"><div class="rg-section-title"><h2>수리 안내</h2><span>02</span></div><div class="rg-copy">${escape(s.notice)}</div></section><div class="rg-contact"><div><span>궁금한 점이 있으신가요?</span><strong>${escape(s.center)}</strong></div><div class="rg-contact-numbers"><a href="tel:${escape(String(s.centerPhone).replace(/[^0-9+]/g,''))}"><span>담당자 윤유현 부장</span>${escape(s.centerPhone)} ↗</a><a href="tel:024655582"><span>서비스센터 대표전화</span>02-465-5582 ↗</a></div></div><div class="rg-response"></div><footer class="rg-footer">KGM 성수서비스센터<span>고객님의 안전한 일상으로 함께합니다.</span></footer></main></div>`;

    const response=target.querySelector('.rg-response');
    response.innerHTML='<div class="rg-actions"><button type="button" class="rg-primary" data-confirm>확인</button></div>';
    const confirm=response.querySelector('[data-confirm]');
    const status=document.createElement('p');status.setAttribute('role','status');response.append(status);
    function completed(value){confirm.textContent='확인했습니다';confirm.disabled=true;status.textContent='확인 일시: '+time(value.created);}
    if(view.confirmation)completed(view.confirmation);
    confirm.onclick=async()=>{
      if(preview){target.closest('dialog')?.close();return;}
      if(demo){confirm.textContent='확인했습니다';return;}
      confirm.disabled=true;
      try{completed(await onConfirm());}catch(e){status.textContent=e.message||'저장하지 못했습니다. 다시 눌러주세요.';confirm.disabled=false;}
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
