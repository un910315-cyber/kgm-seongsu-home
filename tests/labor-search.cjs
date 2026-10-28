'use strict';
// 견적검색(un/app-labor-search.js) 엑셀 읽기·저장 형식·검색 규칙. 실제 공임표(금액)는 저장소에 두지 않으므로 금액은 지어낸 값만 쓴다.
const assert=require('node:assert/strict');
const L=require('../un/app-labor-search.js');
const sheets={
 '공임코드':[
  [],
  ['작업코드','작업명','작업분류','공수(M/H)','일반공임(원)','보험공임(원)','보증공임(원)','상태','보증상태','작업구분','금액조회상태'],
  ['8228800','앞-범퍼 어퍼훼시아 탈부착','탈부착','0.5','12,345','12,345','6,789','사용','사용','일반','조회완료'],
  ['8228900','앞-범퍼 로워훼시아 탈부착','탈부착','','','','','사용','미사용','일반','현재 조회 조건에서 공임 데이터 미반환'],
  ['8211600','LH   앞휀더 (좌) 탈부착','탈부착','1.0','20000','20000','7000','사용','사용','일반','조회완료'],
  ['0001001','작명취소','기타','','','','','일시보류','일시보류','일반',''],
  ['0F24005','가니쉬-프론트 휠아치(좌-범퍼)','탈부착','0.3','1000','1000','500','미사용','미사용','일반','조회완료'],
  ['3010320','휠얼라인먼트  （기계식）','점검','0.5','-1200','0','0','사용','사용','일반','조회완료'],
  ['8228800','중복 행','탈부착','','','','','사용','사용','일반',''],
  ['','빈 코드','','','','','','','','',''],
 ],
 '추출정보':[['금액 추출 시각','2026-10-15 15:52:45 (한국시간)'],['금액 조회 기준','기준일 20261015, 모델코드 TEST'],['빈 값','']]
};
const parsed=L.parseWorkbook(sheets);
assert.equal(parsed.sheet,'공임코드');
assert.equal(parsed.rows.length,6);assert.equal(parsed.duplicates,1);
assert.deepEqual(parsed.stats,{count:6,priced:4,used:4});
const bumper=parsed.rows[0];
assert.equal(bumper.general,'12345','thousands separators removed');assert.equal(bumper.warranty,'6789');
assert.equal(parsed.rows[1].general,'','missing price stays blank, not 0');
assert.equal(parsed.rows[3].code,'0001001','leading zeros kept');
assert.equal(parsed.rows[5].general,'-1200','negative amounts kept');
assert.equal(parsed.info['금액 조회 기준'],'기준일 20261015, 모델코드 TEST');assert(!('빈 값' in parsed.info));
assert.throws(()=>L.parseWorkbook({x:[['코드','이름']]}),/작업코드/);

// 저장 형식: 묶음 문자열 → 행 (RTDB가 배열을 객체로 바꿔 돌려줘도 같은 결과)
const chunks=L.encode(parsed.rows);
assert.deepEqual(L.decode(chunks),parsed.rows);
assert.deepEqual(L.decode(Object.assign({},chunks)),parsed.rows);
const big=Array.from({length:4500},(_,i)=>Object.assign({},bumper,{code:String(i)}));
assert.equal(L.encode(big).length,3);assert.equal(L.decode(L.encode(big)).length,4500);

const index=L.buildIndex(parsed.rows);
const codes=(q,o)=>L.search(index,q,o).items.map(x=>x.row.code);
assert.deepEqual(codes(''),[]);
assert.equal(codes('8228800')[0],'8228800','exact code first');
assert.deepEqual(codes('8228'),['8228800','8228900'],'code prefix');
assert.deepEqual(codes('228'),['8228800','8228900'],'code middle digits');
assert.deepEqual(codes('0f24',{includeUnused:true}),['0F24005'],'letters in codes ignore case');
assert.deepEqual(codes('앞범퍼'),['8228800','8228900'],'spaces and hyphens ignored');
assert.deepEqual(codes('앞 범퍼 어퍼'),['8228800'],'every word must match');
assert.deepEqual(codes('펜더'),['8211600'],'펜더 finds 휀더');
assert.deepEqual(codes('프론트범퍼'),['8228800','8228900'],'프론트 finds 앞');
assert.deepEqual(codes('ㅇㅂㅍ'),['8228800','8228900'],'초성');
assert.deepEqual(codes('얼라인먼트 기계식'),['3010320'],'full-width brackets ignored');
assert.deepEqual(codes('범퍼 점검'),[]);
// 미사용·보류는 기본으로 숨기고 몇 건인지 알려준다
let r=L.search(index,'범퍼');
assert.deepEqual(r.items.map(x=>x.row.code),['8228800','8228900']);assert.equal(r.hiddenUnused,1);
r=L.search(index,'범퍼',{includeUnused:true});assert.equal(r.total,3);assert.equal(r.hiddenUnused,0);
assert.deepEqual(L.search(index,'취소',{includeUnused:true}).items.map(x=>x.row.code),['0001001']);
// 분류로 좁히기
r=L.search(index,'탈부착');assert.deepEqual(r.categories,{'탈부착':3});
assert.deepEqual(codes('범퍼',{category:'점검'}),[]);
// 하이라이트는 원래 글자 위치로 (띄어쓰기·기호 포함)
const mark=(name,q)=>L.highlightRanges(name,q).map(([a,b])=>Array.from(name).slice(a,b).join(''));
assert.deepEqual(mark('앞-범퍼 어퍼훼시아 탈부착','앞범퍼'),['앞-범퍼']);
assert.deepEqual(mark('LH   앞휀더 (좌) 탈부착','펜더'),['휀더']);
assert.deepEqual(mark('앞-범퍼 어퍼훼시아 탈부착','ㅇㅂㅍ'),['앞-범퍼']);
assert.deepEqual(mark('앞-범퍼 어퍼훼시아 탈부착','범퍼 탈부'),['범퍼','탈부']);
console.log('PASS labor search: workbook parse (blank vs 0, leading zeros, duplicates), chunk round trip, code/name/초성/synonym search, unused filter, categories, highlight positions');
