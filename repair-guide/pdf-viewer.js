import {getDocument,GlobalWorkerOptions} from './vendor/pdfjs-6.4.299/pdf.min.mjs';

GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-6.4.299/pdf.worker.min.mjs',import.meta.url).href;

// Render only the selected page. Files stay in the browser; no native PDF iframe.
export function mountPdf(host,url){
  const asset=folder=>new URL('./vendor/pdfjs-6.4.299/'+folder+'/',import.meta.url).href;
  const bar=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button'),status=document.createElement('span'),viewport=document.createElement('div'),canvas=document.createElement('canvas');
  bar.className='rg-pdf-toolbar';viewport.className='rg-pdf-viewport';canvas.className='rg-pdf-canvas';
  previous.type=next.type='button';previous.textContent='이전 페이지';next.textContent='다음 페이지';status.setAttribute('role','status');status.textContent='견적서를 불러오는 중…';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','견적서');bar.append(previous,status,next);viewport.append(canvas);host.append(bar,viewport);
  let pdf,pageNumber=1,closed=false,busy=false,task,lastWidth=0;
  const loading=getDocument({url,cMapUrl:asset('cmaps'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts'),wasmUrl:asset('wasm'),iccUrl:asset('iccs'),isEvalSupported:false,enableXfa:false});
  function buttons(){previous.disabled=closed||busy||!pdf||pageNumber<=1;next.disabled=closed||busy||!pdf||pageNumber>=pdf.numPages;}
  async function render(){
    if(closed||busy||!pdf)return;busy=true;buttons();status.textContent='견적서를 표시하는 중…';
    try{
      const page=await pdf.getPage(pageNumber);if(closed)return;
      const base=page.getViewport({scale:1}),width=Math.max(120,viewport.clientWidth-2),fit=Math.min(width/base.width,2);
      const scale=Math.min(fit*(window.devicePixelRatio||1),4096/Math.max(base.width,base.height),Math.sqrt(12000000/(base.width*base.height)));
      const size=page.getViewport({scale});canvas.width=Math.ceil(size.width);canvas.height=Math.ceil(size.height);canvas.style.width=Math.floor(base.width*fit)+'px';canvas.style.height=Math.floor(base.height*fit)+'px';
      task=page.render({canvasContext:canvas.getContext('2d'),viewport:size});await task.promise;if(closed)return;
      canvas.setAttribute('aria-label','견적서 '+pageNumber+' / '+pdf.numPages+' 페이지');canvas.dataset.renderedPage=String(pageNumber);status.textContent=pageNumber+' / '+pdf.numPages+' 페이지';lastWidth=viewport.clientWidth;
    }catch(e){if(!closed){status.textContent='견적서를 표시하지 못했습니다. 파일을 내려받아 확인해주세요.';canvas.hidden=true;}}
    finally{busy=false;buttons();}
  }
  previous.onclick=()=>{if(!busy&&pageNumber>1){pageNumber--;viewport.scrollTop=0;render();}};
  next.onclick=()=>{if(!busy&&pdf&&pageNumber<pdf.numPages){pageNumber++;viewport.scrollTop=0;render();}};
  buttons();loading.promise.then(doc=>{if(closed){doc.destroy();return;}pdf=doc;render();},()=>{if(!closed)status.textContent='PDF를 열지 못했습니다. 파일을 내려받아 확인해주세요.';});
  const observer=new ResizeObserver(()=>{if(!closed&&!busy&&pdf&&Math.abs(viewport.clientWidth-lastWidth)>2)render();});observer.observe(viewport);
  return ()=>{closed=true;observer.disconnect();task?.cancel();loading.destroy().catch(()=>{});};
}
