'use strict';
const crypto=require('node:crypto'),solapi=require('./solapi.cjs');
module.exports=function(db){
 async function single(event){
  const sendId=event.customFields?.kgmSendId;if(!/^[a-f0-9]{64}$/.test(sendId||''))return false;
  const ref=db.collection('sends').doc(sendId),receipt=ref.collection('providerReports').doc(crypto.createHash('sha256').update(JSON.stringify([event.messageId,event.type,event.statusCode,event.dateReported||event.dateProcessed||''])).digest('hex'));
  return db.runTransaction(async tx=>{const [saved,record]=await Promise.all([tx.get(receipt),tx.get(ref)]);if(saved.exists||!record.exists)return false;const patch=solapi.applyReport(record.data(),event);if(!patch)return false;tx.create(receipt,{received:Date.now(),type:event.type,statusCode:String(event.statusCode),messageId:event.messageId});tx.update(ref,patch);return true;});
 }
 async function group(event){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(event.groupId||'')||event.status!=='COMPLETE')return false;
  await db.collection('providerGroupReports').doc(event.groupId).set({groupId:event.groupId,status:'COMPLETE',count:{sentSuccess:Number(event.count?.sentSuccess)||0,sentPending:Number(event.count?.sentPending)||0,sentFailed:Number(event.count?.sentFailed)||0},received:Date.now()});
  const mapping=await db.collection('providerGroups').doc(event.groupId).get();if(!mapping.exists)return false;const ref=db.collection('sends').doc(mapping.data().sendId);
  return db.runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)return false;const row=doc.data();if(row.mode!=='live'||row.provider?.groupId!==event.groupId||row.provider.groupComplete)return false;
   // Group success alone never substitutes for a per-message delivery report.
   const allFailed=Number(event.count?.sentSuccess)===0&&Number(event.count?.sentPending)===0&&Number(event.count?.sentFailed)>0;
   tx.update(ref,{provider:{...row.provider,groupComplete:true,groupCompletedAt:Date.now()},...(allFailed&&row.delivery!=='delivered'?{delivery:'failed'}:{}),events:[...row.events,{kind:'group_complete',created:Date.now()}].slice(-100)});return true;});
 }
 return {single,group};
};
