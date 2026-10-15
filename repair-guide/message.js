(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KgmRepairMessage=factory();})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function text(snapshot){return `안녕하세요.

KGM 성수서비스센터 입니다.

고객님의 ${snapshot.vehicle.carNum||'#{차량번호}'} ${snapshot.vehicle.carModel||'#{차종}'}
차량이 정상적으로 입고되었습니다.

[차량 수리 안내]

아래 버튼을 통해 차량의 수리내용을
확인하실 수 있습니다.

고객님의 소중한 차량을 꼼꼼하고
안전하게 수리하겠습니다.

감사합니다.

KGM성수서비스센터
담당자 : 윤 유현 부장
연락처 : 010-3388-3466
운영시간
평일  ( 오전 8:30 ~ 오후 6:00 )
주말  ( 휴무 )`;}
  function build(snapshot,url){return {templateVersion:'intake-repair-draft-v2',approved:false,variables:{carNum:snapshot.vehicle.carNum,carModel:snapshot.vehicle.carModel,url},text:text(snapshot),button:{name:'입고 및 수리 안내 확인',url},sms:`[KGM 성수서비스센터] ${snapshot.vehicle.carNum} ${snapshot.vehicle.carModel||''} 입고 및 수리 안내\n수리내용 확인: ${url}\n담당자: 윤 유현 부장\n연락처: 010-3388-3466`};}
  return Object.freeze({text,build});
});
