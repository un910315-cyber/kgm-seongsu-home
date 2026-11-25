'use strict';
// 국세청 사업자등록정보 상태조회(공공데이터포털). 조회 전용이며 세금계산서 발급 기능은 없다.
const ENDPOINT='https://api.odcloud.kr/api/nts-businessman/v1/status';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const digits=v=>String(v==null?'':v).replace(/\D/g,'');
function validBno(b){
 if(!/^\d{10}$/.test(b))return false;
 const w=[1,3,7,1,3,7,1,3,5],n=b.split('').map(Number);
 let sum=0;for(let i=0;i<9;i++)sum+=n[i]*w[i];
 sum+=Math.floor(n[8]*5/10);
 return (10-sum%10)%10===n[9];
}
const TAX={'01':'일반과세자','02':'간이과세자','03':'면세사업자','04':'비영리법인·국가기관','05':'비영리법인(수익사업)','06':'고유번호 부여','07':'간이과세자(세금계산서 발급)'};
const STATE={'01':'계속사업자','02':'휴업자','03':'폐업자'};
const date=s=>/^\d{8}$/.test(s||'')?s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6):'';
function shape(row){
 const registered=!!(row.b_stt_cd||row.tax_type_cd);
 return {
  bno:row.b_no,registered,
  taxType:registered?(TAX[row.tax_type_cd]||row.tax_type||''):'',taxTypeCode:row.tax_type_cd||'',
  state:registered?(STATE[row.b_stt_cd]||row.b_stt||''):'',stateCode:row.b_stt_cd||'',
  closedDate:date(row.end_dt),taxTypeChangedDate:date(row.tax_type_change_dt),
  invoiceApplyDate:date(row.invoice_apply_dt),
  note:registered?'':(row.tax_type||'국세청에 등록되지 않은 사업자등록번호입니다.')
 };
}
async function lookup(rawBno,serviceKey,fetchImpl=fetch){
 const bno=digits(rawBno);
 if(bno.length!==10)throw fail(400,'사업자등록번호 10자리를 입력해주세요.');
 if(!validBno(bno))throw fail(400,'사업자등록번호 형식(검증번호)이 맞지 않습니다. 번호를 다시 확인해주세요.');
 const key=serviceKey.includes('%')?decodeURIComponent(serviceKey):serviceKey;
 const url=new URL(ENDPOINT);url.searchParams.set('serviceKey',key);
 let response;
 try{response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({b_no:[bno]}),signal:AbortSignal.timeout(10000)});}
 catch{throw fail(502,'국세청 조회 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해주세요.');}
 if(!response.ok)throw fail(502,'국세청 조회에 실패했습니다. (코드 '+response.status+')');
 const json=await response.json().catch(()=>null),row=json&&Array.isArray(json.data)?json.data[0]:null;
 if(!row)throw fail(502,'국세청 조회 결과를 읽지 못했습니다.');
 return shape(row);
}
module.exports={digits,validBno,shape,lookup,fail};
