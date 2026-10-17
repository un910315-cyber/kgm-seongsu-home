'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const d=require('./domain.cjs'),message=require('./message.cjs');
initializeApp({databaseURL:'https://unmotors-default-rtdb.firebaseio.com'});
const key=defineSecret('KGM_REPAIR_TOKEN_KEY');
const solapiKey=defineSecret('KGM_SOLAPI_API_KEY'),solapiSecret=defineSecret('KGM_SOLAPI_API_SECRET'),reportSecret=defineSecret('KGM_SOLAPI_WEBHOOK_SECRET');
const solapi=require('./solapi.cjs');
const db=getFirestore('kgm-repair'),bucket=getStorage().bucket('unmotors-kgm-repair-private');
const sends=db.collection('sends'),reports=require('./reports.cjs')(db);
const provider=()=>solapi.client({key:solapiKey.value(),secret:solapiSecret.value(),allowDispatch:config.liveEnabled});
const config={mode:'test',liveEnabled:false,center:'KGM 성수서비스센터',centerPhone:'010-3388-3466'};
const bearer=req=>String(req.headers.authorization||'').replace(/^Bearer /,'');
const link=row=>'https://kgm-seongsu.co.kr/repair-guide/?id='+row.id+'#token='+d.tokenFor(row.id,key.value());
const staffView=row=>{const {tokenHash,...result}=row;return {...result,link:link(row)};};
async function existingRead(path,token){
 const url=new URL('https://unmotors-default-rtdb.firebaseio.com/'+path+'.json');url.searchParams.set('auth',token);
 const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw d.fail(403,'기존 입고 정보 조회 권한을 확인해주세요.');return response.json();
}
async function staff(req){
 let user;try{user=await getAuth().verifyIdToken(bearer(req));}catch{throw d.fail(401,'내부 페이지에서 다시 로그인해주세요.');}
 if(!user.email||!user.email_verified)throw d.fail(403,'직원 계정 확인이 필요합니다.');
 const role=await existingRead('allowedEmails/'+user.email.replace(/\./g,','),bearer(req));
 if(!['admin','staff'].includes(role))throw d.fail(403,'접근 권한이 없습니다.');
 return {uid:user.uid,name:user.name||user.email,email:user.email,role,token:bearer(req)};
}
async function manuals(){const rows=await db.collection('manuals').get();const custom=new Map(rows.docs.map(x=>[x.id,x.data()]));return require('./presets.cjs').map(m=>custom.get(m.id)||m);}
async function send(input,user){
 d.validate(input);const mode=input.mode==='live'?'live':'test';if(mode==='live'&&!config.liveEnabled)throw d.fail(403,'실제 발송은 아직 잠겨 있습니다.');const requestHash=d.hash(d.stable(input)),sendId=d.hash(user.uid+':'+input.requestKey),ref=sends.doc(sendId);
 const previous=await ref.get();if(previous.exists){if(previous.data().requestHash!==requestHash)throw d.fail(409,'이미 처리된 요청 번호입니다.');return staffView(previous.data());}
 const now=Date.now(),result=mode==='test'?d.simulated(input.scenario,now):{delivery:'requested',channel:'alimtalk',attempts:[]};let snapshot,version,versionRef,versionKey;
 if(input.resendOf){const old=await sends.doc(input.resendOf).get();if(!old.exists||old.data().admission!==input.admissionId)throw d.fail(404,'이전 안내를 찾을 수 없습니다.');snapshot={...old.data().snapshot,staffName:user.name};version=old.data().version;}
 else{
  const vehicle=await existingRead('records/'+input.admissionId,user.token);if(!vehicle||vehicle._deletedAt)throw d.fail(404,'입고 건을 찾을 수 없습니다.');
  const files=d.prepareFiles(input.files),stored=[];
  for(const f of files){const path=d.hash(input.admissionId)+'/'+f.digest;try{await bucket.file(path).save(f.data,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:f.type,cacheControl:'private, no-store'}});}catch(e){if(Number(e.code)!==412)throw e;}stored.push({id:d.hash(f.digest+f.name),name:f.name,type:f.type,path,size:f.data.length,digest:f.digest});}
  versionKey=d.hash(input.admissionId+':'+d.stable(stored));versionRef=db.collection('versions').doc(versionKey);
  snapshot={center:config.center,centerPhone:config.centerPhone,vehicle:{id:input.admissionId,carNum:String(vehicle.carNum||''),carModel:String(vehicle.carModel||''),name:String(vehicle.name||''),phone:d.phone(input.phone),inDate:String(vehicle.inDate||'')},expectedDeliveryDate:input.expectedDeliveryDate||'',notice:input.notice,files:stored,staffName:user.name};
 }
 const outcome=await db.runTransaction(async tx=>{
  const existing=await tx.get(ref);if(existing.exists){if(existing.data().requestHash!==requestHash)throw d.fail(409,'이미 처리된 요청 번호입니다.');return {row:existing.data(),created:false};}
  if(versionRef){const v=await tx.get(versionRef),counterRef=db.collection('admissions').doc(d.hash(input.admissionId)),counter=await tx.get(counterRef);version=v.exists?v.data().number:(counter.exists?counter.data().version:0)+1;if(!v.exists){tx.create(versionRef,{admission:input.admissionId,number:version,created:now});tx.set(counterRef,{version});}}
  snapshot={...snapshot,estimateVersion:version};
  const row={id:sendId,requestHash,admission:input.admissionId,version,created:now,expires:now+7*86400000,canceled:false,mode,response:'pending',confirmation:null,resend_of:input.resendOf||null,snapshot,staffUid:user.uid,tokenHash:d.hash(d.tokenFor(sendId,key.value())),...result,events:[{kind:'send_requested',created:now},...(mode==='test'?[{kind:'delivery_result',created:now}]:[])]};
  row.message=message.build(snapshot,link(row));if(mode==='live')row.provider={name:'solapi',dispatchClaimedAt:now,fallbackEnabled:true};tx.create(ref,row);return {row,created:true};
 });
 if(outcome.created&&mode==='live'){
  // The durable claim is made before transport. Never automatically retry an ambiguous send.
  try{const result=await provider().send(outcome.row,'01033883466');const accepted=result.messageList||[],failed=result.failedMessageList||[],groupId=result.groupInfo?.groupId||null;
   if(groupId)await db.collection('providerGroups').doc(groupId).set({sendId});
   await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();tx.update(ref,{provider:{...current.provider,groupId,messageIds:accepted.map(m=>m.messageId),acceptedAt:Date.now(),fallbackEnabled:accepted.length>0},delivery:['delivered','failed'].includes(current.delivery)?current.delivery:accepted.length?'requested':failed.length?'failed':'unknown',events:[...current.events,{kind:'provider_accepted',created:Date.now()}]});});
   if(groupId){const completed=await db.collection('providerGroupReports').doc(groupId).get();if(completed.exists)await reports.group(completed.data());}
   for(const event of failed)await reports.single({...event,groupId,customFields:{kgmSendId:sendId},to:outcome.row.snapshot.vehicle.phone,type:event.type||'ATA'});
  }catch{await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(!['delivered','failed'].includes(current.delivery))tx.update(ref,{delivery:'unknown',events:[...current.events,{kind:'dispatch_uncertain',created:Date.now()}]});});}
  return staffView((await ref.get()).data());
 }
 return staffView(outcome.row);
}
async function attachment(res,row,fileId){const f=d.fileFor(row,fileId);res.set('Content-Type',f.type);res.set('Content-Disposition',"inline; filename*=UTF-8''"+encodeURIComponent(f.name));await new Promise((resolve,reject)=>{const stream=bucket.file(f.path).createReadStream();stream.on('error',reject);res.on('finish',resolve);stream.pipe(res);});}
exports.kgmRepairApi=onRequest({region:'asia-northeast3',memory:'512MiB',timeoutSeconds:60,minInstances:0,maxInstances:2,concurrency:2,serviceAccount:'kgm-repair-guide@unmotors.iam.gserviceaccount.com',secrets:[key,solapiKey,solapiSecret],invoker:'public'},async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');
 const origin=req.headers.origin;if(origin){if(!['https://kgm-seongsu.co.kr','https://www.kgm-seongsu.co.kr'].includes(origin)){res.status(403).json({error:'허용되지 않은 접근입니다.'});return;}res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-KGM-Request');res.set('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');}
 if(req.method==='OPTIONS'){res.status(204).end();return;}
 try{
  const parts=req.path.split('/').filter(Boolean);if(parts[0]!=='api')throw d.fail(404,'경로를 확인해주세요.');
  if(parts[1]==='staff'){
   const user=await staff(req),route=parts[2];
   if(req.method==='GET'&&route==='provider'){if(user.role!=='admin')throw d.fail(403,'관리자만 확인할 수 있습니다.');res.json(await provider().readiness());return;}
   if(req.method==='GET'&&route==='config'){res.json(config);return;}
   if(route==='manuals'){
    if(req.method==='PUT'){if(user.role!=='admin')throw d.fail(403,'관리자만 수정할 수 있습니다.');const m=req.body;if(!['basic','insurance','parts'].includes(m.id)||typeof m.title!=='string'||!m.title.trim()||m.title.length>100||typeof m.body!=='string'||!m.body.trim()||m.body.length>6000)throw d.fail(400,'안내문을 확인해주세요.');await db.collection('manuals').doc(m.id).set({id:m.id,title:m.title,body:m.body});}
    else if(req.method!=='GET')throw d.fail(405,'허용되지 않은 요청입니다.');res.json(await manuals());return;
   }
   if(route==='sends'){
    if(parts.length===3){if(req.method==='POST'){res.json(await send(req.body,user));return;}if(req.method==='GET'){const rows=await sends.orderBy('created','desc').limit(500).get();res.json(rows.docs.map(x=>staffView(x.data())));return;}}
    const ref=sends.doc(d.id(parts[3]));const doc=await ref.get();if(!doc.exists)throw d.fail(404,'안내를 찾을 수 없습니다.');const row=doc.data();
    if(req.method==='GET'&&parts[4]==='file'){await attachment(res,row,req.query.id);return;}
    if(req.method==='GET'&&parts.length===4){res.json(staffView(row));return;}
    if(req.method==='POST'&&parts[4]==='refresh-result'){if(row.mode!=='live'||!row.provider?.groupId){res.json(staffView(row));return;}const result=await provider().request('/messages/v4/list?groupId='+encodeURIComponent(row.provider.groupId)+'&limit=20');for(const event of Object.values(result.messageList||{}))await reports.single({...event,customFields:{...event.customFields,kgmSendId:row.id}});res.json(staffView((await ref.get()).data()));return;}
    if(req.method==='POST'&&parts[4]==='cancel'){await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(!current.canceled)tx.update(ref,{canceled:true,events:[...current.events,{kind:'link_canceled',created:Date.now()}]});});res.json({ok:true});return;}
   }
  }else if(parts[1]==='customer'&&parts[2]==='sends'){
   const ref=sends.doc(d.id(parts[3])),row=d.checkToken((await ref.get()).data(),bearer(req));
   if(req.method==='GET'&&parts[4]==='file'){await attachment(res,row,req.query.id);return;}
   if(req.method==='GET'&&parts.length===4){const snapshot={...row.snapshot,files:row.snapshot.files.map(({path,digest,...file})=>file)};res.json({snapshot,response:row.response,confirmation:row.confirmation,mode:row.mode});return;}
   if(req.method==='POST'&&parts[4]==='confirm'){const confirmation=await db.runTransaction(async tx=>{const current=d.checkToken((await tx.get(ref)).data(),bearer(req));if(current.confirmation)return current.confirmation;const value={created:Date.now(),send:current.id,version:current.version,kind:'acknowledgment'};tx.update(ref,{confirmation:value,response:'confirmed',events:[...current.events,{kind:'confirmed',created:value.created}]});return value;});res.json(confirmation);return;}
  }
  throw d.fail(404,'경로를 확인해주세요.');
 }catch(e){if(res.headersSent){res.destroy();return;}res.status(e.status||500).json({error:e.status?e.message:'처리하지 못했습니다. 잠시 후 다시 시도해주세요.'});}
});

exports.kgmSolapiWebhook=onRequest({region:'asia-northeast3',memory:'256MiB',timeoutSeconds:30,minInstances:0,maxInstances:2,concurrency:20,serviceAccount:'kgm-repair-guide@unmotors.iam.gserviceaccount.com',secrets:[reportSecret],invoker:'public'},async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.method!=='POST'){res.status(405).json({error:'POST required'});return;}
 if(!solapi.verifyWebhook(reportSecret.value(),req.headers['x-solapi-secret'])){res.status(401).json({error:'Unauthorized'});return;}
 const eventName=req.headers['x-solapi-event-name'];
 if(!['SINGLE-REPORT','GROUP-REPORT'].includes(eventName)||!Array.isArray(req.body)||req.body.length>100||(req.rawBody?.length||0)>512000){res.status(400).json({error:'Invalid report'});return;}
 try{let matched=0;for(let offset=0;offset<req.body.length;offset+=10){const results=await Promise.all(req.body.slice(offset,offset+10).map(event=>eventName==='SINGLE-REPORT'?reports.single(event):reports.group(event)));matched+=results.filter(Boolean).length;}
 await db.collection('settings').doc('providerHealth').set({lastWebhookAt:Date.now(),lastEvent:eventName,lastMatched:matched},{merge:true});res.status(200).json({ok:true});
 }catch{res.status(503).json({error:'Retry report'});}
});
