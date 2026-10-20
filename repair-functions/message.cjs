(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KgmRepairMessage=factory();})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Read-only verified SOLAPI template. Preserve its whitespace exactly.
  const approvedTemplate=Object.freeze({"id":"KA01TP261015065614722rRtJoCbLTyH","pfId":"KA01PF261015033700760e84NOKvESvs","content":"고객님의 #{차량번호} #{차종}\n차량이 정상적으로 입고되었습니다.\n\n[차량 수리 안내] \n\n아래 버튼을 통해 차량의 수리내용을 \n확인하실 수 있습니다.\n\n고객님의 소중한 차량을 꼼꼼하고 \n안전하게 수리하겠습니다.\n\n감사합니다.\n\nKGM성수서비스센터 \n담당자 : 윤 유현 부장 \n연락처 : 010-3388-3466","buttonName":"차량 수리 안내","version":"KA01TP261015065614722rRtJoCbLTyH-20261016"});
  const deductibleTemplate=Object.freeze({id:'KA01TP261019092629941aRA99IN7rgE',pfId:approvedTemplate.pfId,version:'KA01TP261019092629941aRA99IN7rgE-20261020',content:'안녕하세요. \nKGM 성수서비스센터입니다.\n\n자기부담금을 안내드립니다.\n\n■ 차량번호: #{차량번호}  #{차종}\n■ 자기부담금: #{금액}원\n■ 입금 계좌: IBK 기업은행 \n                         02-465-558200\n■ 예금주: 케이지모빌리티성수서비스센터 주식회사\n\n원활한 차량 출고를 위해 출고 전 입금 부탁드립니다.\n입금 시 차량번호 또는 차주 성함을 기재해 주세요.\n\n문의 사항은 담당자에게 연락 주세요.\n감사합니다.',extra:'운영시간\n평일 ( 오전 8:30 ~ 오후 6:00 )\n주말 . 공휴일 ( 휴 무 )',title:'KGM성수서비스센터 입니다.',subtitle:'안녕하세요',buttonName:null});
  function templateFor(kind){if(!kind||kind==='repair')return approvedTemplate;if(kind==='deductible')return deductibleTemplate;throw Error('안내 종류를 확인해주세요.');}
  function amountText(value){return Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value).toLocaleString('ko-KR'):'[금액]';}
  function text(snapshot){return templateFor(snapshot.kind).content.replace(/#\{(차량번호|차종|금액)\}/g,function(token,name){return name==='금액'?amountText(snapshot.amount):String((name==='차량번호'?snapshot.vehicle.carNum:snapshot.vehicle.carModel)||token);});}
  function build(snapshot,url){
    const t=templateFor(snapshot.kind);
    if(snapshot.kind==='deductible')return {templateVersion:t.version,templateId:t.id,pfId:t.pfId,approved:true,variables:{'#{차량번호}':snapshot.vehicle.carNum,'#{차종}':snapshot.vehicle.carModel,'#{금액}':amountText(snapshot.amount)},text:text(snapshot),extra:t.extra,title:t.title,subtitle:t.subtitle,button:null,sms:text(snapshot)+'\n\n'+t.extra};
    return {templateVersion:t.version,templateId:t.id,pfId:t.pfId,approved:true,variables:{'#{차량번호}':snapshot.vehicle.carNum,'#{차종}':snapshot.vehicle.carModel,'#{안내주소}':String(url).replace(/^https:\/\//,'')},text:text(snapshot),button:{name:t.buttonName,url},sms:'[KGM 성수서비스센터] '+snapshot.vehicle.carNum+' '+(snapshot.vehicle.carModel||'')+' 입고 및 수리 안내\n수리내용 확인: '+url+'\n담당자: 윤 유현 부장\n연락처: 010-3388-3466'};
  }
  return Object.freeze({text,build,approvedTemplate,deductibleTemplate,templateFor,amountText});
});
