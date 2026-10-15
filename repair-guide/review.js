(function(){
  'use strict';
  // Public inspection example only. No API, Firebase, real files or response writes.
  const root=document.getElementById('customer-root');
  const snapshot={
    center:'KGM 성수서비스센터',centerPhone:'010-3388-3466',
    vehicle:{carNum:'123가1234',carModel:'토레스',name:'예시 고객'},
    expectedDeliveryDate:'2026-10-22',
    notice:'고객님 차량의 입고 및 수리 안내입니다.\n\n견적서와 예상 출고일을 확인해주세요.\n첨부 견적은 탈착 전 확인 가능한 손상을 기준으로 작성되며, 추가 손상 확인 및 부품 수급에 따라 수리 내용·금액·출고일이 달라질 수 있습니다.\n\n안내 내용을 확인하신 후 수리 진행 여부를 선택해주세요. 문의가 필요하시면 상담을 요청하실 수 있습니다.',
    files:[],
    consentText:'견적서와 수리 안내를 확인하였으며, 안내된 수리 진행에 동의합니다.',
    identityText:'본 차량의 수리 의뢰자 또는 수리 진행을 승인할 권한이 있는 사람입니다.'
  };
  window.KgmRepairUI.render(root,{snapshot,response:'pending',mode:'demo'},{demo:true});
})();
