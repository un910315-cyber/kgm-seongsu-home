// 작업코드 메인 화면 — 복수 카테고리 선택·사용자 설정
(function(){
'use strict';
var sections=[],selected=new Set(),config={renames:{},hidden:{},order:[],favorites:{},hiddenItems:{},notes:{}},dbMod=null,dbRef=null;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function keyItem(it){return encodeURIComponent(String(it.code||'')+'|'+String(it.name||''));}
function parse(rows){
 var out=[],curB=null,curJ=null;
 function codeOf(row,cols){for(var i=0;i<cols.length;i++){var v=String((row&&row[cols[i]])||'').trim();if(v&&/\d{3,}/.test(v))return v;}return '';}
 function header(t){return !!t&&t.length<=30&&!/\d{3,}/.test(t);}
 function inline(t){var m=t.match(/^(.+?)\s{2,}([0-9][\w\s\/.\-,()]*?)$/);return m&&/\d{3,}/.test(m[2])?{name:m[1].trim(),code:m[2].trim()}:null;}
 function push(cur,item){if(!cur){cur={name:'기타',items:[]};out.push(cur);}cur.items.push(item);return cur;}
 (rows||[]).forEach(function(row){if(!Array.isArray(row))return;var b=String(row[1]||'').trim(),j=String(row[9]||'').trim(),bc=codeOf(row,[5,2,3,4,6,7]),jc=codeOf(row,[13,10,11,12,14,15,16]);
  if(b){if(!bc&&header(b)){curB={name:b.replace(/\s+/g,' '),items:[]};out.push(curB);}else if(bc)curB=push(curB,{name:b,code:bc});else{var bi=inline(b);if(bi)curB=push(curB,bi);}}
  if(j){if(!jc&&header(j)){curJ={name:j.replace(/\s+/g,' '),items:[]};out.push(curJ);}else if(jc)curJ=push(curJ,{name:j,code:jc});else{var ji=inline(j);if(ji)curJ=push(curJ,ji);}}
 });
 return out.filter(function(s){return s.items.length;});
}
function label(name){return (config.renames&&config.renames[name])||name;}
function ordered(){var map={};sections.forEach(function(s){map[s.name]=s;});var result=[];(config.order||[]).forEach(function(n){if(map[n]){result.push(map[n]);delete map[n];}});sections.forEach(function(s){if(map[s.name]){result.push(s);delete map[s.name];}});return result;}
function notify(t,bad){if(window.showNotif)window.showNotif(t,bad);else alert(t);}
function saveConfig(){
 try{localStorage.setItem('kgmWorkCodeUiConfig',JSON.stringify(config));}catch(_){ }
 if(dbMod&&dbRef){dbMod.set(dbRef,config).catch(function(e){console.warn(e);notify('설정 저장 실패: '+e.message,true);});}
}
function loadLocal(){try{var v=JSON.parse(localStorage.getItem('kgmWorkCodeUiConfig')||'null');if(v)config=Object.assign(config,v);}catch(_){}}
function renderHome(){
 var grid=document.getElementById('wcHomeGrid'),count=document.getElementById('wcSelectedCount');if(!grid)return;
 var q=(document.getElementById('wcHomeSearch').value||'').trim().toLowerCase();
 var html=ordered().filter(function(s){return !config.hidden[s.name]&&(!q||(label(s.name)+' '+s.items.map(function(x){return x.name+' '+x.code;}).join(' ')).toLowerCase().includes(q));}).map(function(s){var on=selected.has(s.name);return '<button type="button" class="wc-big-card '+(on?'selected':'')+'" onclick="window._wcToggleCategory(\''+esc(s.name).replace(/&#39;/g,"\\'")+'\')"><span class="wc-big-check">'+(on?'✓':'＋')+'</span><strong>'+esc(label(s.name))+'</strong><em>'+s.items.length+'개 코드</em></button>';}).join('');
 grid.innerHTML=html||'<div class="wc-home-empty">검색되는 큰 항목이 없습니다.</div>';
 if(count)count.textContent=selected.size+'개 선택';
 var view=document.getElementById('wcViewSelected');if(view)view.disabled=!selected.size;
}
window._wcToggleCategory=function(name){if(selected.has(name))selected.delete(name);else selected.add(name);renderHome();};
window._wcClearSelection=function(){selected.clear();renderHome();};
function selectedItems(){var seen={},out=[];ordered().forEach(function(s){if(!selected.has(s.name))return;s.items.forEach(function(it){var k=keyItem(it);if(!seen[k]&&!config.hiddenItems[k]){seen[k]=1;out.push({name:it.name,code:it.code,section:s.name});}});});return out;}
function renderResults(){
 var body=document.getElementById('wcResultList'),title=document.getElementById('wcResultTitle');if(!body)return;var q=(document.getElementById('wcResultSearch').value||'').trim().toLowerCase();var items=selectedItems().filter(function(it){return !q||(it.name+' '+it.code+' '+label(it.section)).toLowerCase().includes(q);});
 if(title)title.textContent='선택한 작업코드 · '+items.length+'개';
 body.innerHTML=items.map(function(it){var k=keyItem(it),fav=!!config.favorites[k];return '<div class="wc-result-item"><button class="wc-fav '+(fav?'on':'')+'" onclick="window._wcFavorite(\''+encodeURIComponent(k)+'\')">★</button><div class="wc-result-main"><span class="wc-result-section">'+esc(label(it.section))+'</span><strong>'+esc(it.name)+'</strong>'+(config.notes[k]?'<small>'+esc(config.notes[k])+'</small>':'')+'</div><button class="wc-result-code" onclick="window._wcCopy(\''+esc(it.code).replace(/&#39;/g,"\\'")+'\')">'+esc(it.code)+'</button><button class="wc-note" onclick="window._wcNote(\''+encodeURIComponent(k)+'\')">메모</button><button class="wc-hide-item" onclick="window._wcHideItem(\''+encodeURIComponent(k)+'\')">숨김</button></div>';}).join('')||'<div class="wc-home-empty">표시할 코드가 없습니다.</div>';
}
window._wcOpenSelected=function(){if(!selected.size)return;document.getElementById('wcResultsModal').classList.add('open');document.getElementById('wcResultSearch').value='';renderResults();};
window._wcCopy=function(code){navigator.clipboard.writeText(code).then(function(){notify('작업코드 '+code+' 복사 완료');}).catch(function(){notify('복사하지 못했습니다',true);});};
window._wcFavorite=function(k){k=decodeURIComponent(k);config.favorites[k]=!config.favorites[k];saveConfig();renderResults();};
window._wcNote=function(k){k=decodeURIComponent(k);var v=prompt('이 코드에 표시할 메모를 입력하세요.',config.notes[k]||'');if(v===null)return;if(v.trim())config.notes[k]=v.trim();else delete config.notes[k];saveConfig();renderResults();};
window._wcHideItem=function(k){k=decodeURIComponent(k);config.hiddenItems[k]=true;saveConfig();renderResults();};
function renderSettings(){var box=document.getElementById('wcSettingsList');if(!box)return;box.innerHTML=ordered().map(function(s,i){return '<div class="wc-setting-row"><span>'+esc(label(s.name))+' <small>('+s.items.length+')</small></span><button onclick="window._wcMove(\''+encodeURIComponent(s.name)+'\',-1)">↑</button><button onclick="window._wcMove(\''+encodeURIComponent(s.name)+'\',1)">↓</button><button onclick="window._wcRename(\''+encodeURIComponent(s.name)+'\')">이름수정</button><button onclick="window._wcHideCategory(\''+encodeURIComponent(s.name)+'\')">'+(config.hidden[s.name]?'다시표시':'숨김')+'</button></div>';}).join('');}
window._wcOpenSettings=function(){document.getElementById('wcSettingsModal').classList.add('open');renderSettings();};
window._wcRename=function(n){n=decodeURIComponent(n);var v=prompt('큰 항목 이름을 입력하세요.',label(n));if(v===null)return;v=v.trim();if(v&&v!==n)config.renames[n]=v;else delete config.renames[n];saveConfig();renderSettings();renderHome();};
window._wcHideCategory=function(n){n=decodeURIComponent(n);config.hidden[n]=!config.hidden[n];selected.delete(n);saveConfig();renderSettings();renderHome();};
window._wcMove=function(n,d){n=decodeURIComponent(n);var arr=ordered().map(function(s){return s.name;}),i=arr.indexOf(n),j=i+d;if(i<0||j<0||j>=arr.length)return;var t=arr[i];arr[i]=arr[j];arr[j]=t;config.order=arr;saveConfig();renderSettings();renderHome();};
window._wcResetSettings=function(){if(!confirm('큰 항목 이름·순서·숨김·즐겨찾기·메모 설정을 모두 원본으로 복구할까요?'))return;config={renames:{},hidden:{},order:[],favorites:{},hiddenItems:{},notes:{}};selected.clear();saveConfig();renderSettings();renderHome();notify('작업코드 설정을 원본으로 복구했습니다.');};
window._wcSwitchView=function(view){var home=document.getElementById('estimateWorkCodeHome'),table=document.getElementById('estimateWorkCodeTableView'),vehicle=document.getElementById('estimateVehicleView');home.style.display=view==='codes'?'block':'none';if(table)table.style.display=view==='table'?'block':'none';vehicle.style.display=view==='vehicle'?'block':'none';document.querySelectorAll('.estimate-view-tab').forEach(function(b){b.classList.toggle('active',b.dataset.view===view);});if(view==='codes')renderHome();if(view==='table'){var s=document.getElementById('workCodeSearch');if(s)s.dispatchEvent(new Event('input',{bubbles:true}));}};
function build(){
 var page=document.getElementById('page-estimate');if(!page||document.getElementById('estimateWorkCodeHome'))return;
 var children=Array.prototype.slice.call(page.childNodes),vehicle=document.createElement('div');vehicle.id='estimateVehicleView';vehicle.style.display='none';children.forEach(function(n){vehicle.appendChild(n);});
 var tabs=document.createElement('div');tabs.className='estimate-view-tabs';tabs.innerHTML='<button class="estimate-view-tab active" data-view="codes" onclick="window._wcSwitchView(\'codes\')">작업코드 참고</button><button class="estimate-view-tab" data-view="table" onclick="window._wcSwitchView(\'table\')">작업코드표</button><button class="estimate-view-tab" data-view="vehicle" onclick="window._wcSwitchView(\'vehicle\')">차량 모형 견적</button>';
 var home=document.createElement('div');home.id='estimateWorkCodeHome';home.className='wc-home';home.innerHTML='<div class="wc-home-head"><div><h2>작업코드 참고</h2><p>필요한 큰 항목을 여러 개 선택한 뒤 코드만 모아서 확인하세요.</p></div><button class="btn btn-ghost" onclick="window._wcOpenSettings()">⚙ 큰 항목 설정</button></div><div class="wc-home-toolbar"><input id="wcHomeSearch" placeholder="큰 항목·작업명·코드 검색" oninput="window._wcRenderHome()"><span id="wcSelectedCount">0개 선택</span><button class="btn btn-ghost" onclick="window._wcClearSelection()">전체 해제</button><button class="btn btn-primary" id="wcViewSelected" onclick="window._wcOpenSelected()" disabled>선택 코드 보기</button></div><div id="wcHomeGrid" class="wc-home-grid"></div>';
 var tableView=document.createElement('div');tableView.id='estimateWorkCodeTableView';tableView.className='wc-table-view';tableView.style.display='none';tableView.innerHTML='<div class="wc-table-view-head"><div><h2>작업코드표</h2><p>기존에 사용하던 작업코드 최종본을 그대로 검색하고 확인할 수 있습니다.</p></div></div>';var refModal=document.getElementById('workCodeRefModal'),refBody=refModal&&refModal.querySelector('.modal-body');if(refBody){tableView.appendChild(refBody);refModal.style.display='none';}var oldRefBtn=vehicle.querySelector('[onclick*="_openWorkCodeRef"]');if(oldRefBtn)oldRefBtn.setAttribute('onclick',"window._wcSwitchView('table')");page.appendChild(tabs);page.appendChild(home);page.appendChild(tableView);page.appendChild(vehicle);
 document.body.insertAdjacentHTML('beforeend','<div class="modal-overlay" id="wcResultsModal"><div class="modal wc-results-modal"><div class="modal-header"><div class="modal-title" id="wcResultTitle">선택한 작업코드</div><button class="modal-close" onclick="document.getElementById(\'wcResultsModal\').classList.remove(\'open\')">×</button></div><div class="modal-body"><input id="wcResultSearch" class="wc-result-search" placeholder="선택된 코드 안에서 검색" oninput="window._wcRenderResults()"><div id="wcResultList" class="wc-result-list"></div></div></div></div><div class="modal-overlay" id="wcSettingsModal"><div class="modal wc-settings-modal"><div class="modal-header"><div class="modal-title">큰 항목 설정</div><button class="modal-close" onclick="document.getElementById(\'wcSettingsModal\').classList.remove(\'open\')">×</button></div><div class="modal-body"><p class="wc-settings-help">이름·순서·표시 여부를 원하는 대로 바꿀 수 있습니다.</p><div id="wcSettingsList"></div><button class="btn btn-ghost wc-reset-btn" onclick="window._wcResetSettings()">원본 설정으로 복구</button></div></div></div>');
 window._wcRenderHome=renderHome;window._wcRenderResults=renderResults;renderHome();
}
function connect(){if(!window._fbDb||!window._fbRef){setTimeout(connect,300);return;}import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js').then(function(m){dbMod=m;dbRef=window._fbRef(window._fbDb,'workCodes/uiConfig');m.onValue(dbRef,function(s){var v=s.val();if(v&&typeof v==='object')config=Object.assign({renames:{},hidden:{},order:[],favorites:{},hiddenItems:{},notes:{}},v);renderHome();});}).catch(function(e){console.warn('work code ui config',e);});}
function init(){sections=parse(window._workCodeStatic||[]);loadLocal();build();connect();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();