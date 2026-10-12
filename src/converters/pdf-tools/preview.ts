import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type {ResourceBudget,MemoryLease,ReleaseHandle} from '../../core/resources/budget';
import type {ExecutionGate} from '../../core/resources/execution';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function renderPdfPreview(blob:Blob,number:number,canvas:HTMLCanvasElement,signal:AbortSignal,resources:{budget:ResourceBudget;execution:ExecutionGate}):Promise<()=>void>{
 let task:ReturnType<typeof getDocument>|undefined,dataLease:MemoryLease|undefined,canvasLease:MemoryLease|undefined,slot:ReleaseHandle|undefined;
 const cleanCanvas=()=>{canvas.width=0;canvas.height=0;canvasLease?.release();canvasLease=undefined;};
 const abort=()=>{void task?.destroy().catch(()=>{});cleanCanvas();};signal.addEventListener('abort',abort,{once:true});
 try{
  signal.throwIfAborted();slot=await new Promise<ReleaseHandle>((resolve,reject)=>{let unsubscribe=()=>{};const cancelled=()=>{unsubscribe();reject(new Error('pdf_cancelled'));};const acquire=()=>{const value=resources.execution.tryAcquire('pdf-tools-preview',true);if(value){unsubscribe();signal.removeEventListener('abort',cancelled);resolve(value);}};unsubscribe=resources.execution.subscribe(acquire);signal.addEventListener('abort',cancelled,{once:true});acquire();});
  signal.throwIfAborted();dataLease=resources.budget.reserve('transient',blob.size+16*1024**2,'pdf-tools-preview');const data=new Uint8Array(await blob.arrayBuffer());signal.throwIfAborted();
  const assets=new URL(`${import.meta.env.BASE_URL}pdf-assets/`,document.baseURI).href;
  task=getDocument({data,maxImageSize:24000000,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,cMapUrl:`${assets}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assets}standard_fonts/`,wasmUrl:`${assets}wasm/`,verbosity:0});
  const pdf=await task.promise;signal.throwIfAborted();const page=await pdf.getPage(number);const original=page.getViewport({scale:1});
  if(![original.width,original.height].every(value=>Number.isFinite(value)&&value>0&&value<=20000))throw new Error('pdf_page_invalid');
  const scale=Math.min(600/original.width,800/original.height,Math.sqrt(1000000/(original.width*original.height))),viewport=page.getViewport({scale});
  canvasLease=resources.budget.reserve('transient',Math.ceil(viewport.width)*Math.ceil(viewport.height)*4*3,'pdf-tools-canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const context=canvas.getContext('2d');if(!context)throw new Error('resource-limit');const render=page.render({canvas,canvasContext:context,viewport,background:'rgb(255,255,255)',annotationMode:0});const cancel=()=>render.cancel();signal.addEventListener('abort',cancel,{once:true});
  try{await render.promise;signal.throwIfAborted();}finally{signal.removeEventListener('abort',cancel);page.cleanup();}
  return()=>{signal.removeEventListener('abort',abort);cleanCanvas();};
 }catch(error){signal.removeEventListener('abort',abort);cleanCanvas();throw error;}
 finally{try{await task?.destroy();}finally{dataLease?.release();slot?.release();}}
}
