import workerUrl from '../../workers/pdf-tools.worker.ts?worker&url';
import {PDF_TOOLS_LIMITS,type PdfRequest,type PdfResponse} from '../../core/pdf-tools/types';
const codes=new Set(['pdf_invalid','pdf_encrypted','pdf_file_limit','pdf_total_limit','pdf_page_limit','pdf_page_invalid','pdf_output_limit','pdf_result_limit','pdf_selection','pdf_empty','pdf_cancelled','pdf_timeout','resource-limit']);
export function pdfError(error:unknown):string{return error instanceof Error&&codes.has(error.message)?error.message:'pdf_invalid';}
export function runPdfWorker(request:PdfRequest,signal:AbortSignal,progress:(value:number)=>void):Promise<PdfResponse>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error('pdf_cancelled'));return;}
  let worker:Worker;try{worker=new Worker(workerUrl,{type:'module'});}catch{reject(new Error('pdf_invalid'));return;}
  let finished=false;
  const finish=(result?:PdfResponse,error?:string)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;if(result)resolve(result);else reject(new Error(error??'pdf_invalid'));};
  const abort=()=>finish(undefined,'pdf_cancelled');
  const timer=setTimeout(()=>finish(undefined,'pdf_timeout'),PDF_TOOLS_LIMITS.timeoutMs);
  signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{const message=event.data;if(message?.kind==='progress'&&Number.isFinite(message.value)){progress(Math.max(0,Math.min(100,message.value)));return;}if(message?.kind==='result'&&Array.isArray(message.result?.info)&&Array.isArray(message.result?.outputs)){finish(message.result);return;}finish(undefined,codes.has(message?.error)?message.error:'pdf_invalid');};
  worker.onerror=()=>finish(undefined,'pdf_invalid');worker.onmessageerror=()=>finish(undefined,'pdf_invalid');
  try{worker.postMessage(request);}catch{finish(undefined,'pdf_invalid');}
 });
}
