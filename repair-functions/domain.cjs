'use strict';
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function id(value){if(typeof value!=='string'||!/^[-_a-zA-Z0-9]{1,160}$/.test(value))throw fail(400,'요청 번호를 확인해주세요.');return value;}
function phone(value){const result=String(value||'').replace(/[\s-]/g,'');if(!/^0\d{8,10}$/.test(result))throw fail(400,'수신 연락처를 확인해주세요.');return result;}
function prepareFiles(files){
 if(!Array.isArray(files)||files.length<1||files.length>5)throw fail(400,'견적서를 1~5개 첨부해주세요.');let total=0;
 return files.map(f=>{if(typeof f.data!=='string'||f.data.length>28*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))throw fail(400,'파일 형식이 올바르지 않습니다.');const data=Buffer.from(f.data,'base64');total+=data.length;if(!data.length||total>20*1024*1024)throw fail(413,'첨부 파일은 합계 20MB까지 가능합니다.');
 const type=data.subarray(0,5).toString()==='%PDF-'?'application/pdf':data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':null;
 if(!type||f.type!==type)throw fail(400,'PDF, JPG, PNG 파일만 첨부해주세요.');return {data,type,digest:hash(data),name:String(f.name||'견적서').replace(/[\x00-\x1f\x7f]/g,'').slice(0,180)};
 });
}
function validate(input){id(input.admissionId);if(!/^[a-zA-Z0-9-]{16,100}$/.test(input.requestKey||''))throw fail(400,'요청 번호를 확인해주세요.');if(input.resendOf){id(input.resendOf);return;}
 phone(input.phone);if(typeof input.notice!=='string'||!input.notice.trim()||input.notice.length>6000)throw fail(400,'안내 내용을 확인해주세요.');const date=input.expectedDeliveryDate||'';if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw fail(400,'예상 출고일을 확인해주세요.');}
function tokenFor(sendId,key){return crypto.createHmac('sha256',key).update('kgm-repair-link-v1:'+sendId).digest('base64url');}
function checkToken(row,token,now=Date.now()){
 if(!row||typeof token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(token)||!row.tokenHash)throw fail(404,'안내 링크를 확인해주세요.');const actual=Buffer.from(hash(token),'hex'),expected=Buffer.from(row.tokenHash,'hex');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw fail(404,'안내 링크를 확인해주세요.');if(row.canceled||row.expires<=now)throw fail(410,'사용 기간이 지났거나 취소된 안내입니다. 센터로 문의해주세요.');return row;
}
function fileFor(row,fileId){const file=row.snapshot.files.find(f=>f.id===fileId);if(!file)throw fail(404,'견적서를 찾을 수 없습니다.');return file;}
function simulated(scenario,now){
 const attempt=(channel,status,reason='')=>({channel,status,reason,created:now});
 switch(scenario){case 'failed':return {delivery:'failed',channel:'alimtalk',attempts:[attempt('alimtalk','failed','테스트 실패 결과')]};case 'fallback-delivered':return {delivery:'delivered',channel:'lms',attempts:[attempt('alimtalk','failed','테스트 대체발송 조건'),attempt('lms','delivered')]};case 'fallback-failed':return {delivery:'failed',channel:'lms',attempts:[attempt('alimtalk','failed','테스트 대체발송 조건'),attempt('lms','failed','테스트 실패 결과')]};case 'unknown':return {delivery:'unknown',channel:'alimtalk',attempts:[attempt('alimtalk','unknown')]};case 'delivered':return {delivery:'delivered',channel:'alimtalk',attempts:[attempt('alimtalk','delivered')]};default:throw fail(400,'테스트 결과를 선택해주세요.');}
}
module.exports={hash,fail,stable,id,phone,prepareFiles,validate,tokenFor,checkToken,fileFor,simulated};
