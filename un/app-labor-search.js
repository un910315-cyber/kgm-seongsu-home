// 견적도우미 > 견적검색: KGM 전체 공임코드를 코드 숫자·한글 작업명·초성으로 검색.
// 공임표(금액 포함)는 공개 저장소에 두지 않고 Firebase laborCodes에 저장한다 (읽기: 관리자·Staff 1단계, 올리기: 관리자).
(function(root){
 'use strict';
 const COLS=['code','name','category','manHour','general','insurance','warranty','status','warrantyStatus','jobType'];
 const HEADERS={code:['작업코드'],name:['작업명'],category:['작업분류'],manHour:['공수(M/H)','공수'],general:['일반공임(원)','일반공임'],insurance:['보험공임(원)','보험공임'],warranty:['보증공임(원)','보증공임'],status:['상태','일반상태'],warrantyStatus:['보증상태'],jobType:['작업구분']};
 const NUMERIC=['manHour','general','insurance','warranty'];
 const CHUNK=2000;
 const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
 // 같은 부품을 다르게 부르는 말. 검색어에 들어 있으면 다른 표기도 함께 찾는다.
 const SYNONYMS=[['휀더','펜더','훼더'],['후드','본넷','보닛','본네트'],['판넬','패널'],['라디에이터','라디에타','라지에타','라지에이터'],['쇽업소버','쇽업쇼버','쇼바','쇼크업소버'],['헤드램프','헤드라이트','전조등'],['테일램프','후미등'],['배터리','밧데리','바테리'],['아웃사이드미러','사이드미러','백미러','os미러'],['유리','글라스'],['트렁크','테일게이트'],['미션','변속기','트랜스미션'],['에바','에바포레이터','증발기'],['앞','프론트','frt'],['뒤','리어','rr'],['좌','lh'],['우','rh']];
 const STRIP=/[\s\-_()[\]{}\/\\·.,~+:;'"|<>*&#!?%（）／　]/g;
 function normalize(s){return String(s==null?'':s).toLowerCase().replace(STRIP,'');}
 function choseong(s){let out='';for(const ch of String(s)){const c=ch.charCodeAt(0);out+=c>=0xAC00&&c<=0xD7A3?CHO[Math.floor((c-0xAC00)/588)]:ch;}return out;}
 function variants(token){
  let list=[token];
  for(const group of SYNONYMS){
   const next=[];
   for(const t of list){next.push(t);const hit=group.find(w=>t.includes(w));if(hit)group.forEach(w=>{if(w!==hit)next.push(t.split(hit).join(w));});}
   list=Array.from(new Set(next)).slice(0,24);
  }
  return list;
 }
 function cleanText(v){return String(v==null?'':v).replace(/[\t\r\n]+/g,' ').trim();}
 function cleanNumber(v){const s=cleanText(v).replace(/[,\s원]/g,'');return s===''||isNaN(Number(s))?'':String(Number(s));}

 // 엑셀 시트들({이름: 2차원 배열})에서 공임코드 시트를 찾아 행 객체로 바꾼다.
 function parseWorkbook(sheets){
  let found=null;
  for(const name of Object.keys(sheets||{})){
   const rows=sheets[name]||[];
   const h=rows.findIndex(r=>Array.isArray(r)&&r.map(cleanText).includes('작업코드')&&r.map(cleanText).includes('작업명'));
   if(h>=0){found={name,rows,h};break;}
  }
  if(!found)throw Error('작업코드·작업명 열이 있는 시트를 찾지 못했어요.');
  const head=found.rows[found.h].map(cleanText),idx={};
  COLS.forEach(k=>{idx[k]=head.findIndex(x=>HEADERS[k].includes(x));});
  const seen=new Set(),rows=[];let duplicates=0;
  for(const r of found.rows.slice(found.h+1)){
   if(!Array.isArray(r))continue;
   const code=cleanText(r[idx.code]);if(!code)continue;
   if(seen.has(code)){duplicates++;continue;}
   seen.add(code);
   const row={};
   COLS.forEach(k=>{const v=idx[k]>=0?r[idx[k]]:'';row[k]=NUMERIC.includes(k)?cleanNumber(v):cleanText(v);});
   row.code=code;rows.push(row);
  }
  if(!rows.length)throw Error('공임코드 행이 없어요.');
  const info={};
  for(const name of Object.keys(sheets)){
   if(name===found.name)continue;
   for(const r of sheets[name]||[]){if(Array.isArray(r)&&cleanText(r[0])&&cleanText(r[1]))info[cleanText(r[0])]=cleanText(r[1]);}
  }
  return {sheet:found.name,rows,duplicates,info,stats:stats(rows)};
 }
 function stats(rows){return {count:rows.length,priced:rows.filter(r=>r.general!=='').length,used:rows.filter(r=>r.status==='사용').length};}
 function encode(rows){const out=[];for(let i=0;i<rows.length;i+=CHUNK)out.push(rows.slice(i,i+CHUNK).map(r=>COLS.map(k=>r[k]||'').join('\t')).join('\n'));return out;}
 function decode(chunks){
  const list=Array.isArray(chunks)?chunks:Object.keys(chunks||{}).sort((a,b)=>a-b).map(k=>chunks[k]);
  const rows=[];
  list.forEach(text=>String(text||'').split('\n').forEach(line=>{if(!line)return;const v=line.split('\t'),row={};COLS.forEach((k,i)=>{row[k]=v[i]||'';});rows.push(row);}));
  return rows;
 }
 function buildIndex(rows){
  return rows.map(r=>{const n=normalize(r.name);return Object.assign({},r,{_c:r.code.toLowerCase(),_n:n,_cho:choseong(n),_x:normalize(r.category+' '+r.jobType)});});
 }
 // 검색어를 띄어쓰기로 나눠 모두 맞는 행만 남긴다 (네이버처럼 띄어쓰기·기호·대소문자 무시).
 function search(index,query,opts){
  opts=opts||{};
  const tokens=String(query||'').split(/[\s,]+/).map(normalize).filter(Boolean);
  const result={items:[],total:0,hiddenUnused:0,categories:{}};
  if(!tokens.length)return result;
  const whole=normalize(query);
  const matchers=tokens.map(t=>({t,cho:/^[ㄱ-ㅎ]+$/.test(t),vs:variants(t)}));
  const matched=[];
  for(const row of index){
   let score=0,ok=true,byCode=true;
   for(const m of matchers){
    let s=0;
    if(m.cho){if(row._cho.includes(m.t))s=row._cho.startsWith(m.t)?60:30;}
    else{
     if(row._c===m.t)s=1000;else if(row._c.startsWith(m.t))s=400;else if(m.t.length>=3&&row._c.includes(m.t))s=150;
     for(const v of m.vs){if(row._n.startsWith(v))s=Math.max(s,90);else if(row._n.includes(v))s=Math.max(s,50);}
     if(!s&&m.vs.some(v=>row._x.includes(v)))s=15;
    }
    if(!s){ok=false;break;}
    if(s<150)byCode=false;
    score+=s;
   }
   if(!ok)continue;
   if(tokens.length>1&&row._n.includes(whole))score+=40;
   if(row.status==='사용')score+=20;
   if(row.general!=='')score+=5;
   // 코드로 찾은 결과는 코드 순서대로, 작업명으로 찾은 결과는 짧은(더 딱 맞는) 이름부터.
   if(!byCode)score-=row.name.length*0.2;
   matched.push({row,score});
  }
  const usable=opts.includeUnused?matched:matched.filter(x=>x.row.status==='사용');
  result.hiddenUnused=matched.length-usable.length;
  usable.forEach(x=>{const c=categoryLabel(x.row.category);result.categories[c]=(result.categories[c]||0)+1;});
  result.items=(opts.category?usable.filter(x=>categoryLabel(x.row.category)===opts.category):usable)
   .sort((a,b)=>b.score-a.score||(a.row.code<b.row.code?-1:a.row.code>b.row.code?1:0));
  result.total=result.items.length;
  return result;
 }
 function categoryLabel(c){return !c||c==='-선택-'?'미지정':c;}
 // 원래 작업명에서 검색어가 맞은 구간 (띄어쓰기·기호를 무시하고 찾았으므로 위치를 되돌려 계산).
 function highlightRanges(name,query){
  const map=[];let n='';
  Array.from(String(name)).forEach((ch,i)=>{const x=normalize(ch);for(let j=0;j<x.length;j++){n+=x[j];map.push(i);}});
  const cho=choseong(n),ranges=[];
  String(query||'').split(/[\s,]+/).map(normalize).filter(Boolean).forEach(t=>{
   const hay=/^[ㄱ-ㅎ]+$/.test(t)?cho:n,list=/^[ㄱ-ㅎ]+$/.test(t)?[t]:variants(t);
   list.forEach(v=>{let at=hay.indexOf(v);while(v&&at>=0){ranges.push([map[at],map[at+v.length-1]+1]);at=hay.indexOf(v,at+v.length);}});
  });
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged=[];ranges.forEach(r=>{const last=merged[merged.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r.slice());});
  return merged;
 }
 const core={COLS,normalize,choseong,variants,parseWorkbook,encode,decode,buildIndex,search,highlightRanges,categoryLabel};
 if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(!root.document)return;

 // ---- 화면 ----
 const CACHE_KEY='kgmLaborCodesCache',PAGE=80;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const el=id=>document.getElementById(id);
 const state={phase:'idle',error:'',meta:null,index:[],query:'',includeUnused:false,category:'',limit:PAGE,timer:0};
 let dbMod=null,built=false;
 function notify(t,bad){if(root.showNotif)root.showNotif(t,bad);else alert(t);}
 function isAdmin(){return root._userRole==='admin';}
 function waitDb(){
  return new Promise(resolve=>{const tick=()=>{if(root._fbDb&&root._fbRef)resolve();else setTimeout(tick,300);};tick();})
   .then(()=>dbMod||import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js').then(m=>(dbMod=m)));
 }
 function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null');}catch(_){return null;}}
 function writeCache(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v));}catch(_){}}
 function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){}}
 async function load(){
  state.phase='loading';state.error='';render();
  try{
   const m=await waitDb();
   const meta=(await m.get(root._fbRef(root._fbDb,'laborCodes/meta'))).val();
   if(!meta){clearCache();state.meta=null;state.index=[];state.phase='empty';render();return;}
   const cached=readCache();let chunks;
   if(cached&&cached.version===meta.version)chunks=cached.chunks;
   else{chunks=(await m.get(root._fbRef(root._fbDb,'laborCodes/chunks'))).val();writeCache({version:meta.version,chunks});}
   state.meta=meta;state.index=buildIndex(decode(chunks));state.phase='ready';
  }catch(e){
   console.warn('labor codes',e);
   const denied=/permission/i.test(String(e&&(e.code||e.message)||''));
   if(denied)clearCache();
   state.phase='error';state.error=denied?'공임표를 볼 권한이 없어요. 관리자·Staff 1단계만 볼 수 있어요.':'공임표를 불러오지 못했어요. 잠시 뒤 다시 열어주세요.';
  }
  render();
 }
 function build(host){
  host.innerHTML='<div class="lab-head"><div><h2>견적검색</h2><p>KGM 공임코드를 코드 숫자나 작업명으로 찾아요. 코드를 누르면 복사돼요.</p></div>'
   +'<div class="lab-admin" id="labAdmin" hidden><input type="file" id="labFile" accept=".xlsx,.xls" hidden><button type="button" class="btn btn-ghost" id="labUploadBtn">공임표 엑셀 올리기</button></div></div>'
   +'<div class="lab-searchbar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
   +'<input id="labQuery" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="공임코드 검색" placeholder="작업코드 또는 작업명 (예: 8228800, 앞범퍼 탈부착, ㅇㅂㅍ)">'
   +'<button type="button" class="lab-clear" id="labClear" aria-label="검색어 지우기" hidden>×</button></div>'
   +'<div class="lab-options"><div class="lab-cats" id="labCats"></div><label class="lab-toggle"><input type="checkbox" id="labUnused"> 미사용·보류 코드도 보기</label></div>'
   +'<div class="lab-status" id="labStatus" aria-live="polite"></div><div class="lab-results" id="labResults"></div>'
   +'<button type="button" class="btn btn-ghost lab-more" id="labMore" hidden>더 보기</button><p class="lab-note" id="labNote"></p>';
  const q=el('labQuery');
  q.addEventListener('input',()=>{clearTimeout(state.timer);state.timer=setTimeout(()=>setQuery(q.value),120);});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(state.timer);setQuery(q.value);}if(e.key==='Escape'){q.value='';setQuery('');}});
  el('labClear').addEventListener('click',()=>{q.value='';setQuery('');q.focus();});
  el('labUnused').addEventListener('change',e=>{state.includeUnused=e.target.checked;state.category='';state.limit=PAGE;render();});
  el('labMore').addEventListener('click',()=>{state.limit+=PAGE;render();});
  el('labUploadBtn').addEventListener('click',()=>el('labFile').click());
  el('labFile').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)upload(f);});
  host.addEventListener('click',e=>{
   const code=e.target.closest('[data-lab-copy]');if(code){copy(code.dataset.labCopy);return;}
   const cat=e.target.closest('[data-lab-cat]');if(cat){state.category=cat.dataset.labCat;state.limit=PAGE;render();return;}
   const ex=e.target.closest('[data-lab-example]');if(ex){q.value=ex.dataset.labExample;setQuery(q.value);q.focus();}
  });
 }
 function setQuery(v){state.query=v.trim();state.category='';state.limit=PAGE;render();}
 function copy(code){
  const done=()=>notify(code+' 복사했어요');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(done,()=>fallbackCopy(code,done));else fallbackCopy(code,done);
 }
 function fallbackCopy(text,done){const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy');done();}catch(_){notify('복사하지 못했어요',true);}t.remove();}
 function won(v){return v===''?'<span class="lab-none" title="BOLT에서 금액이 오지 않은 코드">—</span>':esc(Number(v).toLocaleString('ko-KR'));}
 function marked(text,ranges){let out='',at=0;ranges.forEach(([a,b])=>{out+=esc(text.slice(at,a))+'<mark>'+esc(text.slice(a,b))+'</mark>';at=b;});return out+esc(text.slice(at));}
 function codeHtml(code,query){
  const tokens=String(query).split(/[\s,]+/).map(normalize).filter(t=>t&&/^[0-9a-z]+$/.test(t));
  const lower=code.toLowerCase(),t=tokens.find(x=>lower.includes(x));
  if(!t)return esc(code);const i=lower.indexOf(t);return marked(code,[[i,i+t.length]]);
 }
 function rowHtml(r,query){
  const chars=Array.from(r.name),ranges=highlightRanges(r.name,query).map(([a,b])=>[chars.slice(0,a).join('').length,chars.slice(0,b).join('').length]);
  const tags=[];
  if(r.status!=='사용')tags.push('<span class="lab-tag is-off">'+esc(r.status==='일시보류'?'보류':r.status||'상태 없음')+'</span>');
  else if(r.warrantyStatus&&r.warrantyStatus!=='사용')tags.push('<span class="lab-tag">보증 '+esc(r.warrantyStatus)+'</span>');
  if(r.jobType==='엔진')tags.push('<span class="lab-tag">엔진</span>');
  const general=r.general!==''&&r.insurance!==''&&r.insurance!==r.general?won(r.general)+'<small>보험 '+won(r.insurance)+'</small>':won(r.general);
  return '<div class="lab-row'+(r.status!=='사용'?' is-off':'')+'">'
   +'<button type="button" class="lab-code" data-lab-copy="'+esc(r.code)+'" title="눌러서 코드 복사">'+codeHtml(r.code,query)+'</button>'
   +'<div class="lab-name">'+marked(r.name,ranges)+tags.join('')+'</div>'
   +'<div class="lab-cat">'+esc(categoryLabel(r.category)==='미지정'?'':r.category)+'</div>'
   +'<div class="lab-num"><span class="lab-k">공수</span>'+(r.manHour===''?'<span class="lab-none">—</span>':esc(r.manHour))+'</div>'
   +'<div class="lab-num"><span class="lab-k">일반·보험</span>'+general+'</div>'
   +'<div class="lab-num"><span class="lab-k">보증</span>'+won(r.warranty)+'</div></div>';
 }
 function render(){
  const host=el('estimateLaborSearchView');if(!host)return;
  if(!built){build(host);built=true;}
  el('labAdmin').hidden=!isAdmin();
  el('labClear').hidden=!state.query;
  const status=el('labStatus'),results=el('labResults'),cats=el('labCats'),more=el('labMore'),note=el('labNote');
  more.hidden=true;cats.innerHTML='';
  const meta=state.meta;
  note.textContent=meta?('BOLT 견적작성 작업검색 '+(meta.extractedAt||'').replace(/\s*\(한국시간\)/,'')+' 추출본. 금액 기준: '+(meta.basis||'표시 없음')+'. 차량·기준일이 달라지면 금액이 다를 수 있어요. 금액이 —인 코드는 BOLT에서 금액이 오지 않은 코드예요.'):'';
  if(state.phase==='loading'||state.phase==='idle'){status.textContent='공임표를 불러오는 중…';results.innerHTML='';return;}
  if(state.phase==='error'){status.textContent='';results.innerHTML='<div class="lab-empty">'+esc(state.error)+'</div>';return;}
  if(state.phase==='empty'){status.textContent='';results.innerHTML='<div class="lab-empty">아직 올라온 공임표가 없어요.<br>'+(isAdmin()?'오른쪽 위 <b>공임표 엑셀 올리기</b>로 공임표 파일을 올려주세요.':'관리자에게 공임표를 올려 달라고 해주세요.')+'</div>';return;}
  if(!state.query){
   const n=v=>Number(v||0).toLocaleString('ko-KR');
   status.textContent='공임코드 '+n(meta.count)+'건 · 사용 '+n(meta.used)+'건 · 금액 있는 코드 '+n(meta.priced)+'건';
   results.innerHTML='<div class="lab-empty lab-hint">이렇게 찾아보세요'+['8228800','앞범퍼 탈부착','펜더','휠얼라인먼트','ㅇㅂㅍ'].map(x=>'<button type="button" data-lab-example="'+esc(x)+'">'+esc(x)+'</button>').join('')+'<small>띄어쓰기·기호는 무시하고, 여러 단어는 모두 들어간 것만 찾아요. 초성(ㅇㅂㅍ)과 펜더/휀더 같은 다른 표기도 찾아요.</small></div>';
   return;
  }
  const res=search(state.index,state.query,{includeUnused:state.includeUnused,category:state.category});
  const catList=Object.entries(res.categories).sort((a,b)=>b[1]-a[1]);
  const totalAll=catList.reduce((s,x)=>s+x[1],0);
  if(catList.length>1)cats.innerHTML='<button type="button" data-lab-cat=""'+(state.category?'':' class="active"')+'>전체 '+totalAll+'</button>'
   +catList.slice(0,8).map(([c,n])=>'<button type="button" data-lab-cat="'+esc(c)+'"'+(state.category===c?' class="active"':'')+'>'+esc(c)+' '+n+'</button>').join('');
  status.textContent='‘'+state.query+'’ 검색 결과 '+res.total.toLocaleString('ko-KR')+'건'+(res.hiddenUnused?' · 미사용·보류 '+res.hiddenUnused.toLocaleString('ko-KR')+'건 숨김':'');
  if(!res.total){results.innerHTML='<div class="lab-empty">맞는 공임코드가 없어요.'+(res.hiddenUnused?'<br>아래 <b>미사용·보류 코드도 보기</b>를 켜면 '+res.hiddenUnused+'건이 더 있어요.':'<br>단어를 줄이거나 다른 표기로 찾아보세요.')+'</div>';return;}
  results.innerHTML='<div class="lab-row lab-row-head" aria-hidden="true"><div>작업코드</div><div>작업명</div><div>분류</div><div class="lab-num">공수</div><div class="lab-num">일반·보험</div><div class="lab-num">보증</div></div>'
   +res.items.slice(0,state.limit).map(x=>rowHtml(x.row,state.query)).join('');
  if(res.total>state.limit){more.hidden=false;more.textContent='더 보기 ('+state.limit+' / '+res.total.toLocaleString('ko-KR')+')';}
 }
 function upload(file){
  if(!isAdmin()){notify('관리자만 공임표를 올릴 수 있어요',true);return;}
  if(!root._loadXlsx){notify('엑셀 도구를 불러오지 못했어요',true);return;}
  el('labStatus').textContent='엑셀 파일 읽는 중…';
  root._loadXlsx(()=>{
   const reader=new FileReader();
   reader.onerror=()=>notify('파일을 읽지 못했어요',true);
   reader.onload=async ev=>{
    let parsed;
    try{
     const wb=root.XLSX.read(new Uint8Array(ev.target.result),{type:'array'}),sheets={};
     wb.SheetNames.forEach(n=>{sheets[n]=root.XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:'',raw:false});});
     parsed=parseWorkbook(sheets);
    }catch(e){render();notify('공임표를 읽지 못했어요: '+e.message,true);return;}
    const s=parsed.stats;
    if(!confirm('공임코드 '+s.count.toLocaleString('ko-KR')+'건 (사용 '+s.used.toLocaleString('ko-KR')+'건, 금액 있는 코드 '+s.priced.toLocaleString('ko-KR')+'건)을 올릴까요?'+(parsed.duplicates?'\n중복 코드 '+parsed.duplicates+'건은 첫 줄만 남겨요.':'')+'\n지금 올라가 있는 공임표는 이 파일로 바뀌어요.')){render();return;}
    const now=new Date().toISOString();
    const meta={version:now,count:s.count,used:s.used,priced:s.priced,extractedAt:parsed.info['금액 추출 시각']||'',basis:parsed.info['금액 조회 기준']||'',sourceFile:file.name,sheet:parsed.sheet,uploadedAt:now,uploadedBy:root._userEmail||''};
    const chunks=encode(parsed.rows);
    try{
     const m=await waitDb();
     el('labStatus').textContent='저장 중…';
     await m.set(root._fbRef(root._fbDb,'laborCodes'),{meta,chunks});
     writeCache({version:meta.version,chunks});
     state.meta=meta;state.index=buildIndex(parsed.rows);state.phase='ready';render();
     notify('공임표 '+s.count.toLocaleString('ko-KR')+'건을 올렸어요');
    }catch(e){
     console.error('labor codes upload',e);render();
     notify(/permission/i.test(String(e&&(e.code||e.message)||''))?'저장 권한이 없어요 (관리자 전용)':'저장하지 못했어요: '+e.message,true);
    }
   };
   reader.readAsArrayBuffer(file);
  });
 }
 // 견적도우미 탭에서 '견적검색'을 열 때 부른다 (app-workcodes-ui.js).
 root._laborSearchShow=function(){
  render();
  if(state.phase==='idle'||state.phase==='error')load();
  setTimeout(()=>{const q=el('labQuery');if(q&&matchMedia('(min-width: 701px)').matches)q.focus();},30);
 };
})(typeof window!=='undefined'?window:globalThis);
