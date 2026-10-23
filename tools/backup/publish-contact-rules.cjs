'use strict';
// 거래처 공개 범위를 데이터베이스 규칙으로 막는 작업 (2026-10-24).
//   node tools/backup/publish-contact-rules.cjs                 점검만 (읽기 + 규칙 dryRun, 쓰기 없음)
//   node tools/backup/publish-contact-rules.cjs --publish-rules 규칙 게시 (운영 규칙이 작업 전 그대로일 때만)
//   node tools/backup/publish-contact-rules.cjs --migrate       직원·관리자 전용 거래처를 새 위치로 옮김 (규칙 게시 뒤에만)
// 옮길 때는 복사 → 확인 → 옛 위치에서 삭제 순서로 하고, 전체 공개 거래처는 건드리지 않는다.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {clients}=require('./firebase-session.cjs');
const candidate=require('./build-rules.cjs');
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'rules-before-contacts-20261024.json'),'utf8'));
const NODES={staff:'vendorContactsStaff',admin:'vendorContactsAdmin'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

async function main(){
 const api=await clients();
 const get=async p=>(await api.database.get(p)).body;
 const dry=await api.database.request({method:'PUT',path:'/.settings/rules.json',queryParams:{dryRun:'true'},body:JSON.stringify(candidate),resolveOnHTTPError:true});
 if(dry.status!==200)throw Error('규칙 검증 실패: '+JSON.stringify(dry.body));
 const live=await get('/.settings/rules.json');
 const state=same(live,candidate)?'published':same(live,before)?'before':'drift';
 const vendors=await get('/vendorContacts.json')||{};
 const moving=Object.entries(vendors).filter(([,v])=>v&&NODES[v.visibility]);
 const counts={all:Object.keys(vendors).length-moving.length,staff:moving.filter(([,v])=>v.visibility==='staff').length,admin:moving.filter(([,v])=>v.visibility==='admin').length};
 const existing={};
 for(const [vis,node] of Object.entries(NODES))existing[vis]=state==='published'?(await get('/'+node+'.json')||{}):{};
 console.log('규칙 상태: '+state+' / 공개 목록에 남은 전체공개 '+counts.all+'곳, 옮길 직원전용 '+counts.staff+'곳, 관리자전용 '+counts.admin+'곳');
 console.log('새 위치에 이미 있는 거래처: 직원전용 '+Object.keys(existing.staff).length+'곳, 관리자전용 '+Object.keys(existing.admin).length+'곳');
 if(state==='drift')throw Error('운영 규칙이 작업 전 상태와도, 새 규칙과도 다릅니다. 덮어쓰지 않고 멈춥니다.');

 if(process.argv.includes('--publish-rules')){
  if(state==='published'){console.log('이미 새 규칙이 게시돼 있습니다.');}
  else{
   await api.database.request({method:'PUT',path:'/.settings/rules.json',body:JSON.stringify(candidate)});
   assert.deepEqual(await get('/.settings/rules.json'),candidate);
   console.log('새 규칙 게시와 재조회 확인 완료.');
  }
 }

 if(process.argv.includes('--migrate')){
  assert.deepEqual(await get('/.settings/rules.json'),candidate,'새 규칙이 게시된 뒤에만 옮길 수 있습니다.');
  if(!moving.length){console.log('옮길 거래처가 없습니다.');return;}
  const copy={};
  for(const [id,v] of moving)copy[NODES[v.visibility]+'/'+id]=v;
  await api.database.patch('/.json',copy);
  for(const [id,v] of moving){
   const saved=await get('/'+NODES[v.visibility]+'/'+id+'.json');
   assert.deepEqual(saved,v,'복사 확인 실패: '+id);
  }
  console.log(moving.length+'곳 새 위치 복사·확인 완료.');
  const drop={};
  for(const [id] of moving)drop['vendorContacts/'+id]=null;
  await api.database.patch('/.json',drop);
  const left=await get('/vendorContacts.json')||{};
  assert(Object.values(left).every(v=>!v||!NODES[v.visibility]),'공개 목록에 전용 거래처가 남아 있습니다.');
  console.log('공개 목록에서 '+moving.length+'곳 삭제·확인 완료. 남은 전체공개 '+Object.keys(left).length+'곳.');
 }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
