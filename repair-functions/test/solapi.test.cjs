'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),p=require('../solapi.cjs'),message=require('../message.cjs');
const snapshot={vehicle:{carNum:'12가3456',carModel:'토레스',phone:'01000000000'}};
const row=()=>({id:'a'.repeat(64),mode:'live',snapshot,message:message.build(snapshot,'https://kgm-seongsu.co.kr/repair-guide/?id=abc#token=example'),provider:{groupId:'GROUP1',fallbackEnabled:true},attempts:[],events:[],response:'confirmed',confirmation:{created:1}});
const event=(extra={})=>({messageId:'MESSAGE1',groupId:'GROUP1',customFields:{kgmSendId:'a'.repeat(64)},to:'01000000000',type:'ATA',statusCode:'4000',dateReported:'2026-10-16T00:00:00Z',...extra});
test('webhook authentication rejects missing, wrong and malformed hashes',()=>{const hash=crypto.createHash('sha1').update('test-secret').digest('hex');assert(p.verifyWebhook('test-secret',hash));assert(!p.verifyWebhook('other',hash));for(const invalid of [null,'','bad','A'.repeat(39)])assert(!p.verifyWebhook('test-secret',invalid));});
test('acceptance differs from delivery; fallback and stale reports preserve confirmation',()=>{assert.equal(p.state('2000'),'requested');assert.equal(p.state('3000'),'requested');assert.equal(p.state('4000'),'delivered');assert.equal(p.state('3104'),'failed');assert.equal(p.state('9999'),'unknown');let r=row();Object.assign(r,p.applyReport(r,event({statusCode:'3104'})));assert.equal(r.delivery,'requested');Object.assign(r,p.applyReport(r,event({type:'LMS',messageId:'SMS1',statusCode:'4000'})));assert.equal(r.delivery,'delivered');assert.equal(r.channel,'lms');assert.deepEqual(r.confirmation,{created:1});assert.equal(r.response,'confirmed');assert.equal(p.applyReport(r,event({type:'LMS',messageId:'SMS1',statusCode:'3000'})),null);assert.equal(p.applyReport({...r,mode:'test'},event()),null);assert.equal(p.applyReport(r,event({to:'01011111111'})),null);assert.equal(p.applyReport(r,event({groupId:'OTHER'})),null);});
test('both channels fail; exact template and private link are retained in fallback',()=>{let r=row();Object.assign(r,p.applyReport(r,event({statusCode:'3104'})));Object.assign(r,p.applyReport(r,event({messageId:'SMS2',type:'LMS',statusCode:'3056'})));assert.equal(r.delivery,'failed');const request=p.payload(r,'01033883466');assert.equal(request.messages[0].text,r.message.text);assert.equal(request.messages[0].kakaoOptions.templateId,message.approvedTemplate.id);assert(request.messages[0].replacements[0].text.includes(r.message.button.url));assert.equal(request.allowDuplicates,false);assert.throws(()=>p.payload({...r,mode:'test'},'01033883466'));});
test('transport lock blocks network; ambiguous request is never retried',async()=>{let calls=0;const fetcher=async()=>{calls++;throw Error('network timeout');};await assert.rejects(()=>p.client({key:'fake',secret:'fake',fetcher}).send(row(),'01033883466'));assert.equal(calls,0);await assert.rejects(()=>p.client({key:'fake',secret:'fake',fetcher,allowDispatch:true}).send(row(),'01033883466'));assert.equal(calls,1);});

test('deductible reports track delivery separately; template ID cannot be overridden',()=>{
 const snapshot={kind:'deductible',amount:200000,vehicle:{carNum:'12가3456',carModel:'토레스',phone:'01000000000'}};
 const r={...row(),kind:'deductible',snapshot,response:'not_required',confirmation:null,message:message.build(snapshot)};
 const request=p.payload(r,'01033883466');assert.equal(request.messages[0].kakaoOptions.templateId,message.deductibleTemplate.id);assert(!request.messages[0].kakaoOptions.variables['#{안내주소}']);
 Object.assign(r,p.applyReport(r,event()));assert.equal(r.delivery,'delivered');assert.equal(r.response,'not_required');assert.equal(r.confirmation,null);
 assert.throws(()=>p.payload({...r,message:{...r.message,templateId:'unapproved'}},'01033883466'));
});
test('accident notice payload uses only its approved template and car number',()=>{
 const snapshot={kind:'accident',vehicle:{carNum:'12가3456',carModel:'토레스',phone:'01000000000'}};
 const r={...row(),kind:'accident',snapshot,response:'not_required',confirmation:null,message:message.build(snapshot)};
 const request=p.payload(r,'01033883466'),m=request.messages[0];assert.equal(m.kakaoOptions.templateId,message.accidentTemplate.id);assert.equal(m.kakaoOptions.pfId,message.approvedTemplate.pfId);
 assert.deepEqual(m.kakaoOptions.variables,{'#{차량번호}':'12가3456'});assert(m.text.startsWith('KGM 성수서비스센터입니다.'));assert(m.replacements[0].text.includes('12가3456 차량의 사고 접수가 완료되었습니다.'));
 Object.assign(r,p.applyReport(r,event()));assert.equal(r.delivery,'delivered');assert.equal(r.confirmation,null);
 assert.throws(()=>p.payload({...r,message:{...r.message,templateId:message.deductibleTemplate.id}},'01033883466'));
});
test('vat notice payload uses only its approved template, car number, model, supply amount and VAT',()=>{
 const snapshot={kind:'vat',amount:1000000,vat:100000,vehicle:{carNum:'12가3456',carModel:'토레스',phone:'01000000000'}};
 const r={...row(),kind:'vat',snapshot,response:'not_required',confirmation:null,message:message.build(snapshot)};
 const request=p.payload(r,'01033883466'),m=request.messages[0];assert.equal(m.kakaoOptions.templateId,'KA01TP261124002618715TuwL0I9iwZo');assert.equal(m.kakaoOptions.pfId,message.approvedTemplate.pfId);
 assert.deepEqual(m.kakaoOptions.variables,{'#{차량번호}':'12가3456','#{차종}':'토레스','#{공급가액}':'1,000,000','#{부가세}':'100,000'});
 assert(m.text.includes('■ 수리비(공급가액): 1,000,000원\n■ 부가세: 100,000원'));assert(!m.text.includes('#{'));assert(m.replacements[0].text.includes('운영시간'));
 assert.throws(()=>p.payload({...r,message:{...r.message,templateId:message.deductibleTemplate.id}},'01033883466'));
});
