'use strict';
// 데이터베이스 규칙 게시 (일반용). 운영 규칙이 지정한 기준 파일과 똑같을 때만 build-rules.cjs 결과로 바꾼다.
//   node tools/backup/publish-rules.cjs --baseline tools/backup/rules-before-XXXX.json            점검만 (dryRun, 쓰기 없음)
//   node tools/backup/publish-rules.cjs --baseline tools/backup/rules-before-XXXX.json --publish  게시 + 재조회 확인
// 기준 파일은 게시 직전 운영 규칙의 사본이다. 규칙을 바꿀 때마다 새 기준 파일을 남겨 두고 되돌릴 때도 쓴다.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {clients}=require('./firebase-session.cjs');
const candidate=require('./build-rules.cjs');
const arg=process.argv.indexOf('--baseline');
if(arg<0||!process.argv[arg+1])throw Error('--baseline <파일>을 지정해주세요.');
const baseline=JSON.parse(fs.readFileSync(path.resolve(process.argv[arg+1]),'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

async function main(){
 const api=await clients();
 const dry=await api.database.request({method:'PUT',path:'/.settings/rules.json',queryParams:{dryRun:'true'},body:JSON.stringify(candidate),resolveOnHTTPError:true});
 if(dry.status!==200)throw Error('규칙 검증 실패: '+JSON.stringify(dry.body));
 const live=(await api.database.get('/.settings/rules.json')).body;
 const state=same(live,candidate)?'published':same(live,baseline)?'baseline':'drift';
 const changed=Object.keys(candidate.rules).filter(k=>!same(candidate.rules[k],live.rules&&live.rules[k]));
 console.log('규칙 상태: '+state+(state==='baseline'?' / 바뀔 경로: '+changed.join(', '):''));
 if(state==='drift')throw Error('운영 규칙이 기준 파일과도, 새 규칙과도 다릅니다. 덮어쓰지 않고 멈춥니다.');
 if(!process.argv.includes('--publish'))return;
 if(state==='published'){console.log('이미 게시돼 있습니다.');return;}
 await api.database.request({method:'PUT',path:'/.settings/rules.json',body:JSON.stringify(candidate)});
 assert.deepEqual((await api.database.get('/.settings/rules.json')).body,candidate);
 console.log('새 규칙 게시와 재조회 확인 완료.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
