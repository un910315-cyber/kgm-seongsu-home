'use strict';
const test=require('node:test'),assert=require('node:assert');
const b=require('../bizlookup.cjs');
test('검증번호',()=>{assert(b.validBno('1208800767'));assert(!b.validBno('1208800768'));assert(!b.validBno('123'));});
test('입력 정리와 형식 오류',async()=>{
 await assert.rejects(b.lookup('12345','k',async()=>{throw new Error('no call');}),e=>e.status===400);
 await assert.rejects(b.lookup('120-88-00768','k',async()=>{throw new Error('no call');}),e=>e.status===400);
});
test('일반·간이·미등록·폐업 변환, 키는 쿼리로만',async()=>{
 let seen;const mk=row=>async(url,opt)=>{seen={url:String(url),body:JSON.parse(opt.body)};return {ok:true,json:async()=>({data:[row]})};};
 let r=await b.lookup('120-88-00767','a%2Bb',mk({b_no:'1208800767',b_stt:'계속사업자',b_stt_cd:'01',tax_type:'부가가치세 일반과세자',tax_type_cd:'01',end_dt:''}));
 assert.equal(r.taxType,'일반과세자');assert.equal(r.state,'계속사업자');assert(seen.url.includes('serviceKey=a%2Bb'));assert.deepEqual(seen.body,{b_no:['1208800767']});
 r=await b.lookup('1208800767','k',mk({b_no:'1208800767',b_stt:'계속사업자',b_stt_cd:'01',tax_type_cd:'07',tax_type:'x',invoice_apply_dt:'20250101'}));
 assert.equal(r.taxType,'간이과세자(세금계산서 발급)');assert.equal(r.invoiceApplyDate,'2025-01-01');
 r=await b.lookup('1208800767','k',mk({b_no:'1208800767',b_stt:'폐업자',b_stt_cd:'03',tax_type_cd:'01',end_dt:'20240630'}));
 assert.equal(r.state,'폐업자');assert.equal(r.closedDate,'2024-06-30');
 r=await b.lookup('1208800767','k',mk({b_no:'1208800767',b_stt:'',b_stt_cd:'',tax_type:'국세청에 등록되지 않은 사업자등록번호입니다.',tax_type_cd:''}));
 assert.equal(r.registered,false);assert(r.note.includes('등록되지'));
});
test('상류 오류는 502',async()=>{await assert.rejects(b.lookup('1208800767','k',async()=>({ok:false,status:401})),e=>e.status===502);});
