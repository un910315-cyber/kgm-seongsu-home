(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KgmRepairMessage=factory();})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function text(snapshot){return `[${snapshot.center}]\n\n${snapshot.vehicle.carNum} 차량이 입고되었습니다.\n\n아래 버튼을 눌러 견적서와 예상 출고일 등 수리 안내를 확인하고, 수리 진행 여부를 선택해주세요.\n\n문의: ${snapshot.centerPhone}`;}
  function build(snapshot,url){return {templateVersion:'intake-repair-draft-v1',approved:false,variables:{center:snapshot.center,carNum:snapshot.vehicle.carNum,centerPhone:snapshot.centerPhone,url},text:text(snapshot),button:{name:'입고 및 수리 안내 확인',url},sms:`[${snapshot.center}] ${snapshot.vehicle.carNum} 입고 및 수리 안내\n견적 및 안내 확인: ${url}\n문의: ${snapshot.centerPhone}`};}
  return Object.freeze({text,build});
});
