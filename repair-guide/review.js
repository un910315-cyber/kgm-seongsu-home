(function(){
  'use strict';
  if(new URLSearchParams(location.search).has('id')&&new URLSearchParams(location.search).get('demo')!=='1')return;
  // Public inspection example only. No API, Firebase, real files or response writes.
  const root=document.getElementById('customer-root');
  const snapshot={
    center:'KGM 성수서비스센터',centerPhone:'010-3388-3466',
    vehicle:{carNum:'123가1234',carModel:'토레스',name:'예시 고객'},
    expectedDeliveryDate:'2026-10-22',
    notice:'고객님 차량의 입고 및 수리 안내입니다.\n\n견적서와 예상 출고일을 확인해주세요.\n첨부 견적은 탈착 전 확인 가능한 손상을 기준으로 작성되며, 추가 손상 확인 및 부품 수급에 따라 수리 내용·금액·출고일이 달라질 수 있습니다.\n\n안내 내용을 확인해주세요. 궁금하신 점은 담당자에게 문의해주세요.',
    files:[]
  };
  window.KgmRepairUI.render(root,{snapshot,response:'pending',mode:'demo'},{demo:true});
})();
