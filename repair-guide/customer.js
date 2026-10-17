(async function(){
 'use strict';
 const params=new URLSearchParams(location.search);if(params.get('demo')==='1'||!params.has('id'))return;
 const root=document.getElementById('customer-root'),ui=window.KgmRepairUI,id=params.get('id');
 const fail=message=>{root.innerHTML='<div class="rg-shell"><div class="rg-body"><h1>입고 및 수리 안내</h1><p role="alert">'+ui.escape(message)+'</p><p>담당자: <a href="tel:01033883466">010-3388-3466</a><br>서비스센터: <a href="tel:024655582">02-465-5582</a></p></div></div>';};
 try{
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('안내 링크를 확인해주세요.');
  const storageKey='kgm-repair:'+id;let token=new URLSearchParams(location.hash.slice(1)).get('token');
  if(token){try{sessionStorage.setItem(storageKey,token);}catch{}history.replaceState(null,'',location.pathname+location.search);}else{try{token=sessionStorage.getItem(storageKey);}catch{}}
  if(!/^[-_A-Za-z0-9]{43}$/.test(token||''))throw Error('문자로 받은 안내 링크를 다시 열어주세요.');
  const base=window.KGM_REPAIR_CUSTOMER_API;if(!base)throw Error('고객 안내 연결을 준비 중입니다.');
  async function request(route='',method='GET',file=false){const response=await fetch(base+'/api/customer/sends/'+id+route,{method,headers:{Authorization:'Bearer '+token},cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok){const result=await response.json();throw Error(result.error||'안내를 불러오지 못했습니다.');}return file?response.blob():response.json();}
  const view=await request();ui.render(root,view,{onConfirm:()=>request('/confirm','POST'),onFile:async f=>{try{ui.showFile(f,URL.createObjectURL(await request('/file?id='+encodeURIComponent(f.id),'GET',true)));}catch(e){const area=root.querySelector('.rg-response');const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e.message;area.append(p);}}});
 }catch(e){fail(e.message);}
})();
