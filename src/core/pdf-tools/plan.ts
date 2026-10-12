import type {InputFile} from '../conversion/types';
import {PDF_TOOLS_LIMITS, type PdfSettings} from './types';
function validCount(count:number):void{if(!Number.isInteger(count)||count<1||count>PDF_TOOLS_LIMITS.pages)throw new Error('pdf_page_limit');}
export function parsePages(value:string,count:number):number[]{
 validCount(count);
 if(!value.trim()||value.length>8192)throw new Error('pdf_selection');
 const pages:number[]=[],seen=new Set<number>();
 for(const part of value.split(',')){
  const token=part.trim();if(!/^\d+(?:-\d+)?$/.test(token))throw new Error('pdf_selection');
  const parts=token.split('-'),start=Number(parts[0]),end=Number(parts[1]??parts[0]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end>count||end<start)throw new Error('pdf_selection');
  for(let page=start;page<=end;page++){if(seen.has(page))throw new Error('pdf_selection');seen.add(page);pages.push(page);}
 }
 return pages;
}
export function planOperation(count:number,settings:PdfSettings):number[][]{
 validCount(count);const all=Array.from({length:count},(_,index)=>index+1);
 if(settings.operation==='merge')return [all];
 if(settings.operation==='split'){
  if(!Number.isInteger(settings.splitSize)||settings.splitSize<1||settings.splitSize>count)throw new Error('pdf_selection');
  if(Math.ceil(count/settings.splitSize)>PDF_TOOLS_LIMITS.outputs)throw new Error('pdf_output_limit');
  return Array.from({length:Math.ceil(count/settings.splitSize)},(_,index)=>all.slice(index*settings.splitSize,(index+1)*settings.splitSize));
 }
 const selected=parsePages(settings.selection,count);
 if(settings.operation==='extract')return [selected];
 if(settings.operation==='delete'){const retained=all.filter(page=>!selected.includes(page));if(!retained.length)throw new Error('pdf_empty');return [retained];}
 if(settings.operation==='reorder'){if(selected.length!==count)throw new Error('pdf_selection');return [selected];}
 if(settings.operation==='rotate'){if(![90,180,270].includes(settings.rotation))throw new Error('pdf_selection');return [all];}
 throw new Error('pdf_invalid');
}
export function validatePdfInput(input:InputFile):void{
 if(input.size>PDF_TOOLS_LIMITS.fileBytes)throw new Error('pdf_file_limit');
 if(input.size<=0||input.blob.size!==input.size||!/\.pdf$/i.test(input.name)||!['','application/pdf','application/octet-stream'].includes(input.type))throw new Error('pdf_invalid');
}
