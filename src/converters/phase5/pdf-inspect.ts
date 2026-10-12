import type {P5RunContext} from '../../core/phase5/types';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import {P5Error} from '../../core/phase5/errors';
import {assertLimit,P5_LIMITS} from '../../core/phase5/limits';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function inspectPdfPages(blob:Blob,context:P5RunContext):Promise<number>{
  if(context.signal.aborted)throw new P5Error('cancel');assertLimit('inspectorSource',blob.size);
  let lease;try{lease=context.budget.reserve('transient',96*1024**2,context.taskId);}catch{throw new P5Error('budget');}
  let task:ReturnType<typeof getDocument>|undefined,destroyed:Promise<void>|undefined,timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  const destroy=()=>destroyed??=(task?Promise.resolve().then(()=>task!.destroy()):Promise.resolve());
  const abort=()=>{void destroy().catch(()=>{});};
  try{
    const data=new Uint8Array(await blob.arrayBuffer());if(context.signal.aborted)throw new P5Error('cancel');
    const base=new URL(`${import.meta.env.BASE_URL}pdf-assets/`,document.baseURI);if(base.origin!==location.origin)throw new P5Error('security');
    task=getDocument({data,useSystemFonts:false,disableFontFace:true,enableXfa:false,stopAtErrors:true,disableAutoFetch:true,verbosity:0,cMapUrl:`${base}cmaps/`,cMapPacked:true,standardFontDataUrl:`${base}standard_fonts/`,wasmUrl:`${base}wasm/`});
    task.onPassword=()=>{void destroy().catch(()=>{});};context.signal.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{timedOut=true;abort();},P5_LIMITS.workerTimeout);if(context.signal.aborted)abort();
    const pdf=await task.promise;if(context.signal.aborted)throw new P5Error('cancel');if(timedOut)throw new P5Error('timeout');
    assertLimit('pdfPages',pdf.numPages);if(pdf.numPages<1)throw new P5Error('structure');return pdf.numPages;
  }catch(error){if(context.signal.aborted)throw new P5Error('cancel');if(timedOut)throw new P5Error('timeout');if(error instanceof P5Error)throw error;throw new P5Error('structure');}
  finally{if(timer!==undefined)clearTimeout(timer);context.signal.removeEventListener('abort',abort);try{await destroy();}finally{lease.release();}}
}
