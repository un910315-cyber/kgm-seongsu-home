'use strict';
const crypto=require('node:crypto'),template=require('./message.cjs').approvedTemplate;
function verifyWebhook(secret,received){if(typeof received!=='string'||!/^[a-f0-9]{40}$/i.test(received))return false;const expected=crypto.createHash('sha1').update(secret).digest();return crypto.timingSafeEqual(expected,Buffer.from(received,'hex'));}
function state(code){code=String(code);if(code==='4000')return 'delivered';if(['2000','3000'].includes(code))return 'requested';if(/^[12345]\d{3}$/.test(code))return 'failed';return 'unknown';}
function payload(row,from){
 if(row.mode!=='live')throw Error('Test records cannot be dispatched');
 if(!/^0\d{8,10}$/.test(from))throw Error('Registered sender required');
 const customFields={kgmSendId:row.id},sms={to:row.snapshot.vehicle.phone,from,type:'LMS',text:row.message.sms,customFields};
 return {messages:[{to:row.snapshot.vehicle.phone,from,type:'ATA',text:row.message.text,customFields,kakaoOptions:{pfId:template.pfId,templateId:template.id,disableSms:true,variables:row.message.variables},replacements:[sms]}],allowDuplicates:false,showMessageList:true};
}
function client({key,secret,fetcher=fetch,allowDispatch=false}){
 async function request(route,{method='GET',body}={}){
  if(method!=='GET'&&(!allowDispatch||route!=='/messages/v4/send-many/detail'))throw Error('Live dispatch is locked');
  const date=new Date().toISOString(),salt=crypto.randomBytes(24).toString('hex'),signature=crypto.createHmac('sha256',secret).update(date+salt).digest('hex');
  const response=await fetcher('https://api.solapi.com'+route,{method,headers:{Authorization:`HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok){const error=Error('솔라피 연결 오류 ('+response.status+')');error.providerCode=String(result.errorCode||'UNKNOWN').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);throw error;}return result;
 }
 return {request,send:(row,from)=>request('/messages/v4/send-many/detail',{method:'POST',body:payload(row,from)}),async readiness(){const [templates,senders]=await Promise.all([request('/kakao/v2/templates/?templateId='+template.id+'&limit=10'),request('/senderid/v1/numbers')]);const found=(templates.templateList||templates.templates||[]).find(x=>x.templateId===template.id||x._id===template.id);return {authenticated:true,templateApproved:found?.status==='APPROVED',senderActive:(senders.senderIds||[]).some(x=>x.phoneNumber==='01033883466'&&x.status==='ACTIVE'),liveEnabled:allowDispatch};}};
}
function applyReport(row,event,now=Date.now()){
 if(row.mode!=='live'||event.customFields?.kgmSendId!==row.id||event.to!==row.snapshot.vehicle.phone)return null;
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(event.messageId||'')||!['ATA','SMS','LMS'].includes(event.type)||!/^\d{4}$/.test(String(event.statusCode)))return null;
 if(row.provider?.groupId&&event.groupId!==row.provider.groupId)return null;
 const channel=event.type==='ATA'?'alimtalk':'lms',status=state(event.statusCode),key=event.messageId+':'+event.type,attempts=[...(row.attempts||[])];
 const index=attempts.findIndex(x=>x.providerKey===key),old=attempts[index],reported=Date.parse(event.dateReported||event.dateProcessed||'')||now;
 if(old&&(old.reported>reported||old.status==='delivered'||(old.status==='failed'&&['requested','unknown'].includes(status))))return null;
 const attempt={providerKey:key,messageId:event.messageId,channel,status,statusCode:String(event.statusCode),reason:String(event.statusMessage||'').slice(0,300),created:old?.created||now,reported};if(index<0)attempts.push(attempt);else attempts[index]=attempt;
 const delivered=attempts.find(x=>x.status==='delivered'),fallback=attempts.filter(x=>x.channel==='lms').at(-1),primary=attempts.filter(x=>x.channel==='alimtalk').at(-1);
 let delivery=delivered?'delivered':fallback?fallback.status:primary?.status||'unknown';if(!delivered&&!fallback&&delivery==='failed'&&row.provider?.fallbackEnabled)delivery=row.provider?.groupComplete?'failed':'requested';
 return {attempts,delivery,channel:delivered?.channel||fallback?.channel||primary?.channel||'alimtalk',events:[...(row.events||[]),{kind:'delivery_result',created:now,channel,statusCode:String(event.statusCode)}].slice(-100)};
}
module.exports={verifyWebhook,state,payload,client,applyReport};
