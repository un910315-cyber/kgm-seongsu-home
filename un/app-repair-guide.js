(function(){
  'use strict';const cfg=window.KGM_REPAIR_CONFIG||{};if(!cfg.enabled)return;
  document.body.classList.add('repair-guide-enabled');
  window._repairGuideButton=function(id){if(!['admin','staff'].includes(window._userRole))return '';return '<button type="button" class="btn btn-ghost btn-sm" data-repair-admission="'+window.esc(id)+'">안내 발송</button>';};
  let frame;
  window._mountRepairGuide=function(){if(!window._canAccessPage?.('repairguide'))return;if(!frame){frame=document.getElementById('repairGuideFrame');frame.src='repair-guide/';}else if(window.KgmRepairBridge.selection)frame.contentWindow.postMessage({type:'kgm-repair-select',id:window.KgmRepairBridge.selection},location.origin);};
  window._openRepairGuide=function(id){if(!window._canAccessPage?.('repairguide'))return;window.KgmRepairBridge.selection=id||null;window.switchPage('repairguide');};
  document.addEventListener('click',event=>{const b=event.target.closest('[data-repair-admission]');if(b){event.stopPropagation();window._openRepairGuide(b.dataset.repairAdmission);}});
  window.addEventListener('message',event=>{if(frame&&event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='kgm-repair-focus')frame.scrollIntoView({block:'start'});if(!frame||event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='kgm-repair-height')return;frame.style.height=Math.max(650,Math.min(12000,Number(event.data.height)||650))+'px';});
})();
