import type {P5Input,P5RunContext,P5ReportResult,P5Primitive} from '../../core/phase5/types';
import {P5Error} from '../../core/phase5/errors';
import {P5_LIMITS,assertLimit} from '../../core/phase5/limits';
import {safeOutputName} from '../../core/files/names';
import {imageDimensions} from '../image/dimensions';
const mimes={png:'image/png',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf'};
export function inspectSignature(bytes:Uint8Array):keyof typeof mimes|'unknown'{
  if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return'png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'jpeg';
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.subarray(start,end));
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return'webp';if(ascii(0,5)==='%PDF-')return'pdf';return'unknown';
}
export async function inspectBasic(input:P5Input,structural:boolean,context:P5RunContext):Promise<P5ReportResult>{
  if(context.signal.aborted)throw new P5Error('cancel');assertLimit('inspectorSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');
  let lease;try{lease=context.budget.reserve('transient',2*1024**2,context.taskId);}catch{throw new P5Error('budget');}
  try{
    const extension=(input.name.split(/[\\/]/).pop()?.match(/\.([a-zA-Z0-9]{1,16})$/)?.[1]??'').toLowerCase();
    const fields:Record<string,P5Primitive>={name:safeOutputName(input.name,extension||'bin'),size:input.size,extension,declaredMime:input.type.slice(0,256),signature:'not-checked',lastModified:typeof input.lastModified==='number'&&Number.isFinite(input.lastModified)&&Math.abs(input.lastModified)<=8640000000000000?input.lastModified:'not-provided',author:'not-checked',exif:'not-checked',gps:'not-checked'};
    if(structural){
      const bytes=new Uint8Array(await input.blob.slice(0,64*1024).arrayBuffer());if(context.signal.aborted)throw new P5Error('cancel');const signature=inspectSignature(bytes);fields.signature=signature;fields.mimeMatch=signature!=='unknown'&&input.type===mimes[signature];
      if(signature==='png'||signature==='jpeg'||signature==='webp'){
        assertLimit('imageSource',input.size);try{const dimensions=imageDimensions(bytes,signature);fields.width=dimensions.width;fields.height=dimensions.height;}catch{throw new P5Error('structure');}
      }else if(signature==='pdf'){
        // Release lightweight accounting before the independently bounded PDF operation.
        lease.release();const {inspectPdfPages}=await import('./pdf-inspect');fields.pages=await inspectPdfPages(input.blob,context);
      }
    }
    if(context.signal.aborted)throw new P5Error('cancel');
    const result:P5ReportResult={kind:'report',reportType:'inspection',fields,notices:[]};if(new TextEncoder().encode(JSON.stringify(result)).length>P5_LIMITS.inspectorReport)throw new P5Error('output');return result;
  }finally{lease.release();}
}
