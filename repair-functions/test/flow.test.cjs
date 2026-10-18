'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),{Writable}=require('node:stream'),d=require('../domain.cjs');
const documents=new Map(),objects=new Map(),clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));let lock=Promise.resolve();
const get=key=>({exists:documents.has(key),data:()=>clone(documents.get(key))});
const db={collection(name){return {doc(id){const key=name+'/'+id;return {key,collection:sub=>db.collection(key+'/'+sub),get:async()=>get(key),set:async value=>documents.set(key,clone(value))};},async get(){return {docs:[...documents].filter(([k])=>k.startsWith(name+'/')).map(([k,v])=>({id:k.split('/')[1],data:()=>clone(v)}))};},orderBy(){return {limit(){return {get:async()=>({docs:[...documents].filter(([k])=>k.startsWith(name+'/')).map(([,v])=>({data:()=>clone(v)}))})};}};}};},runTransaction(fn){const task=lock.then(async()=>{const writes=[];const result=await fn({get:async ref=>get(ref.key),create:(ref,v)=>writes.push(()=>{assert(!documents.has(ref.key));documents.set(ref.key,clone(v));}),set:(ref,v)=>writes.push(()=>documents.set(ref.key,clone(v))),update:(ref,v)=>writes.push(()=>documents.set(ref.key,{...documents.get(ref.key),...clone(v)}))});writes.forEach(f=>f());return result;});lock=task.catch(()=>{});return task;}};
const admission={carNum:'12가3456',carModel:'토레스',name:'가상 고객',phone:'01000000000',inDate:'2026-10-16'};
const mocks={
 'firebase-functions/v2/https':{onRequest:(options,fn)=>{assert.equal(options.maxInstances,2);return fn;}},
 'firebase-functions/params':{defineSecret:()=>({value:()=> 'unit-test-secret-not-a-real-secret'})},
 'firebase-admin/app':{initializeApp:()=>{}},
 'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async token=>{if(!['admin','staff','viewer'].includes(token))throw Error();return {uid:token,email:token+'@example.test',email_verified:true,name:'가상 직원'};}})},
 'firebase-admin/database':{getDatabase:()=>({ref:p=>({get:async()=>({val:()=>p.startsWith('allowedEmails/')?p.split('/')[1].split('@')[0]:p==='records/admission-a'||p==='records/admission-b'?clone(admission):null})})})},
 'firebase-admin/firestore':{getFirestore:name=>{assert.equal(name,'kgm-repair');return db;}},
 'firebase-admin/storage':{getStorage:()=>({bucket:()=>({file:path=>({save:async data=>{objects.set(path,Buffer.from(data));},createReadStream:()=>require('node:stream').Readable.from(objects.get(path))})})})}
};
global.fetch=async url=>{const p=new URL(url).pathname.slice(1,-5);return {ok:true,json:async()=>p.startsWith('allowedEmails/')?p.split('/')[1].split('@')[0]:p==='records/admission-a'||p==='records/admission-b'?clone(admission):null};};
const original=Module._load;Module._load=function(name,...args){return mocks[name]||original.call(this,name,...args);};const backend=require('../index.cjs'),handler=backend.kgmRepairApi;Module._load=original;
async function call(path,{method='GET',body,token='admin',query={},origin}={}){let value,code=200;const chunks=[];const res=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});res.headersSent=false;res.set=()=>res;res.status=n=>{code=n;return res;};res.json=v=>{value=v;res.headersSent=true;};await handler({path,method,body,headers:{authorization:'Bearer '+token,...(origin?{origin}:{})},query},res);return {code,value,bytes:Buffer.concat(chunks)};}
const payload=(key,extra={})=>({admissionId:'admission-a',phone:'010-0000-0000',notice:'테스트 안내',expectedDeliveryDate:'2026-10-22',requestKey:key,scenario:'delivered',files:[{name:'견적서.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nvirtual fixture').toString('base64')}],...extra});
const token=row=>new URLSearchParams(new URL(row.link).hash.slice(1)).get('token');
test('isolated full flow: authorization, retry, immutable versions, links, confirm, resend and cancellation',async()=>{
 assert.equal((await call('/api/staff/config',{token:'wrong'})).code,401);
 assert.equal((await call('/api/staff/config',{token:'viewer'})).code,403);
 assert.equal((await call('/api/staff/config',{token:'staff'})).code,403);
 assert.equal((await call('/api/staff/sends',{method:'POST',token:'staff',body:payload('staff-blocked-0001',{mode:'live'})})).code,403);
 assert.equal((await call('/api/staff/config',{origin:'https://evil.test'})).code,403);
 assert.equal((await call('/api/staff/config')).value.liveEnabled,true);
 assert.equal(documents.size,0,'read-only configuration creates no records');
 const input=payload('request-key-00000001');
 const [a,b]=await Promise.all([call('/api/staff/sends',{method:'POST',body:input}),call('/api/staff/sends',{method:'POST',body:input})]);
 assert.equal(a.code,200);assert.equal(a.value.id,b.value.id);assert.equal(documents.size,3);const first=a.value;
 assert.equal(first.message.text,require('../message.cjs').text(first.snapshot));assert.equal(first.snapshot.estimateVersion,1);
 assert.equal((await call('/api/staff/sends',{method:'POST',body:{...input,notice:'changed'}})).code,409);
 const route='/api/customer/sends/'+first.id,t=token(first);
 assert.equal((await call(route,{token:'A'.repeat(43)})).code,404);
 assert.equal((await call(route,{token:t})).value.response,'pending');
 assert.equal((await call(route+'/file',{token:t,query:{id:'other-file'}})).code,404);
 const pdf=await call(route+'/file',{token:t,query:{id:first.snapshot.files[0].id}});assert.equal(pdf.bytes.toString(),'%PDF-1.4\nvirtual fixture');
 const c1=await call(route+'/confirm',{method:'POST',token:t}),c2=await call(route+'/confirm',{method:'POST',token:t});assert.deepEqual(c1.value,c2.value);assert.equal(c1.value.kind,'acknowledgment');
 admission.name='변경된 이름';
 const second=(await call('/api/staff/sends',{method:'POST',body:payload('request-key-00000002',{admissionId:'admission-b',scenario:'fallback-delivered'})})).value;
 assert.equal(second.snapshot.estimateVersion,1);assert.equal(second.channel,'lms');assert.equal(second.attempts.length,2);
 assert.equal((await call('/api/customer/sends/'+second.id,{token:t})).code,404);
 const resend=(await call('/api/staff/sends',{method:'POST',body:{admissionId:'admission-a',resendOf:first.id,requestKey:'request-key-00000003',scenario:'failed'}})).value;
 assert.equal(resend.snapshot.vehicle.name,'가상 고객');assert.equal(resend.version,1);assert.equal(resend.response,'pending');assert.equal(resend.delivery,'failed');assert.notEqual(resend.link,first.link);
 const updated=(await call('/api/staff/sends',{method:'POST',body:payload('request-key-00000004',{files:[{name:'new.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nnew estimate').toString('base64')}],scenario:'unknown'})})).value;
 assert.equal(updated.version,2);assert.equal(updated.delivery,'unknown');
 const unchanged=(await call('/api/staff/sends/'+first.id)).value;assert.deepEqual(unchanged.snapshot,first.snapshot);assert.deepEqual(unchanged.confirmation,c1.value);
 await call('/api/staff/sends/'+first.id+'/cancel',{method:'POST'});assert.equal((await call(route,{token:t})).code,410);assert.equal((await call(route+'/file',{token:t,query:{id:first.snapshot.files[0].id}})).code,410);
 assert.equal((await call('/api/customer/sends/'+resend.id,{token:token(resend)})).code,200);
 assert.equal((await call('/api/staff/manuals',{method:'PUT',token:'staff',body:{}})).code,403);
 assert.equal((await call('/api/staff/manuals',{method:'PUT',body:{id:'basic',title:'수정 안내',body:'변경 안내'}})).code,200);
 assert.equal((await call('/api/staff/sends/'+first.id)).value.snapshot.notice,'테스트 안내');
 assert.equal((await call('/api/staff/sends')).value.length,4);
});
test('file signature, size, expiry and simulated fallback failures',()=>{
 assert.throws(()=>d.prepareFiles([{name:'evil.pdf',type:'application/pdf',data:Buffer.from('<html>').toString('base64')}]));
 assert.throws(()=>d.checkToken({tokenHash:d.hash('A'.repeat(43)),expires:1},'A'.repeat(43)),e=>e.status===410);
 assert.equal(d.simulated('fallback-failed',1).delivery,'failed');assert.equal(d.simulated('fallback-failed',1).attempts.length,2);
 assert.throws(()=>d.validate(payload('request-key-00000005',{expectedDeliveryDate:'2026-02-30'})));
});
test('connected staff and mobile customer UI complete a test send and confirmation',async()=>{
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {chromium}=require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const root=path.resolve(__dirname,'../..');let base,liveUi=false;
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req)body+=chunk;const result=await call(url.pathname,{method:req.method,body:body?JSON.parse(body):undefined,token:(req.headers.authorization||'').replace('Bearer ',''),query:Object.fromEntries(url.searchParams)});if(url.pathname==='/api/staff/config'&&!liveUi){result.value={...result.value,mode:'test',liveEnabled:false};}res.statusCode=result.code;res.setHeader('Content-Type',result.bytes.length?'application/pdf':'application/json');res.end(result.bytes.length?result.bytes:JSON.stringify(result.value));return;}
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<script>window.KgmRepairBridge={role:'admin',config:{previewOnly:false,apiBase:location.origin},getToken:async()=>'admin',getRecords:()=>[${JSON.stringify({id:'admission-a',...admission})}]};</script><iframe id="staff" src="/un/repair-guide/" style="width:100%;height:1600px;border:0"></iframe>`);return;}
  if(url.pathname==='/repair-guide/server-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.KGM_REPAIR_CUSTOMER_API='+JSON.stringify(base));return;}
  let file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/fixture');const frame=page.frameLocator('#staff');await frame.locator('#rg-search').fill('3456');await frame.locator('[data-admission]').click();
  await frame.locator('#rg-upload').setInputFiles({name:'견적서.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nUI test')});
  const count=documents.size;await frame.locator('#rg-preview').click();await frame.locator('#rg-preview-body [data-confirm]').click();assert.equal(documents.size,count);
  await frame.locator('#rg-send').click();await frame.locator('#rg-sent-open').waitFor();const newest=[...documents].filter(([k])=>k.startsWith('sends/')).map(([,v])=>v).sort((a,b)=>b.created-a.created)[0];
  assert.equal(newest.mode,'test');await frame.locator('#rg-send').click();await frame.locator('#rg-send').isEnabled();
  const customer=await browser.newPage({viewport:{width:390,height:844}});customer.on('pageerror',e=>errors.push(e.message));await customer.goto(base+'/repair-guide/?id='+newest.id+'#token='+d.tokenFor(newest.id,'unit-test-secret-not-a-real-secret'));await customer.locator('[data-confirm]').click();await customer.getByText(/확인 일시:/).waitFor();assert(await customer.locator('[data-confirm]').isDisabled());assert.equal(new URL(customer.url()).hash,'');await customer.reload();await customer.getByText(/확인 일시:/).waitFor();assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await frame.locator('[data-tab="history"]').click();await frame.getByRole('button',{name:'보기',exact:true}).first().click();await frame.locator('#rg-detail').waitFor();assert.match(await frame.locator('#rg-detail').innerText(),/고객 확인 기록/);assert.deepEqual(errors,[]);
  liveUi=true;await page.reload();await frame.getByRole('button',{name:'알림톡 발송',exact:true}).waitFor();assert(await frame.locator('#rg-scenario').isHidden());assert.match(await frame.locator('#rg-mode-badge').innerText(),/실제 알림톡 발송/);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('deployed webhook handler authenticates and deduplicates reports without touching customer confirmation',async()=>{
 const sendId='f'.repeat(64),row={id:sendId,mode:'live',snapshot:{vehicle:{phone:'01000000000'}},provider:{groupId:'G1',fallbackEnabled:true},attempts:[],events:[],response:'confirmed',confirmation:{created:1}};documents.set('sends/'+sendId,row);
 const event={messageId:'M1',groupId:'G1',customFields:{kgmSendId:sendId},to:'01000000000',type:'ATA',statusCode:'4000',dateReported:'2026-10-16T00:00:00Z'};
 async function hook(secret,body=[event]){let code=200,value;const res={set(){},status(n){code=n;return this;},json(x){value=x;}};await backend.kgmSolapiWebhook({method:'POST',headers:{'x-solapi-secret':secret,'x-solapi-event-name':'SINGLE-REPORT'},body},res);return {code,value};}
 assert.equal((await hook('wrong')).code,401);const secret=require('crypto').createHash('sha1').update('unit-test-secret-not-a-real-secret').digest('hex');assert.equal((await hook(secret)).code,200);assert.equal((await hook(secret)).code,200);const updated=documents.get('sends/'+sendId);assert.equal(updated.delivery,'delivered');assert.equal(updated.attempts.length,1);assert.equal(updated.events.length,1);assert.deepEqual(updated.confirmation,{created:1});
});

test('live staff dispatch uses one durable claim and waits for delivery reports',async()=>{
 const previousFetch=global.fetch;let dispatches=0;
 global.fetch=async(url,options)=>{if(String(url).includes('/messages/v4/send-many/detail')){dispatches++;const request=JSON.parse(options.body);assert.equal(request.messages.length,1);assert.equal(request.messages[0].kakaoOptions.templateId,require('../message.cjs').approvedTemplate.id);return {ok:true,json:async()=>({messageList:[{messageId:'LIVE_MESSAGE'}],failedMessageList:[],groupInfo:{groupId:'LIVE_GROUP'}})};}return previousFetch(url,options);};
 try{const input=payload('request-live-00000001',{mode:'live'});const [a,b]=await Promise.all([call('/api/staff/sends',{method:'POST',body:input}),call('/api/staff/sends',{method:'POST',body:input})]);assert.equal(a.code,200);assert.equal(b.code,200);assert.equal(a.value.id,b.value.id);assert.equal(dispatches,1);assert.equal(a.value.delivery,'requested');assert.equal(a.value.mode,'live');assert(!a.value.events.some(e=>e.kind==='delivery_result'));await call('/api/staff/sends',{method:'POST',body:input});assert.equal(dispatches,1);assert.equal(a.value.confirmation,null);}finally{global.fetch=previousFetch;}
});
