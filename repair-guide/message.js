(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KgmRepairMessage=factory();})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Read-only verified SOLAPI template. Preserve its whitespace exactly.
  const approvedTemplate=Object.freeze({"id":"KA01TP261015065614722rRtJoCbLTyH","pfId":"KA01PF261015033700760e84NOKvESvs","content":"고객님의 #{차량번호} #{차종}\n차량이 정상적으로 입고되었습니다.\n\n[차량 수리 안내] \n\n아래 버튼을 통해 차량의 수리내용을 \n확인하실 수 있습니다.\n\n고객님의 소중한 차량을 꼼꼼하고 \n안전하게 수리하겠습니다.\n\n감사합니다.\n\nKGM성수서비스센터 \n담당자 : 윤 유현 부장 \n연락처 : 010-3388-3466","buttonName":"차량 수리 안내","version":"KA01TP261015065614722rRtJoCbLTyH-20261016"});
  function text(snapshot){return approvedTemplate.content.replace(/#\{(차량번호|차종)\}/g,function(token,name){return String((name==='차량번호'?snapshot.vehicle.carNum:snapshot.vehicle.carModel)||token);});}
  function build(snapshot,url){return {templateVersion:approvedTemplate.version,templateId:approvedTemplate.id,approved:true,variables:{'#{차량번호}':snapshot.vehicle.carNum,'#{차종}':snapshot.vehicle.carModel,'#{안내주소}':String(url).replace(/^https:\/\//,'')},text:text(snapshot),button:{name:approvedTemplate.buttonName,url},sms:'[KGM 성수서비스센터] '+snapshot.vehicle.carNum+' '+(snapshot.vehicle.carModel||'')+' 입고 및 수리 안내\n수리내용 확인: '+url+'\n담당자: 윤 유현 부장\n연락처: 010-3388-3466'};}
  return Object.freeze({text,build,approvedTemplate});
});
