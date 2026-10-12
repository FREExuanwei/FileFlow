import {planOperation,parsePages} from './plan';
import type {PdfSnapshot} from './store';
export function previewPdfOperation(snapshot:PdfSnapshot):{ok:true;outputs:number;pages:number;order:string}|{ok:false;reason:'empty'|'pending'|'invalid';code?:string}{
 const selected=snapshot.entries.find(entry=>entry.id===snapshot.selected),settings=snapshot.settings;
 if(!selected)return{ok:false,reason:'empty'};
 if(!selected.info||selected.error)return{ok:false,reason:'pending'};
 try{
  if(settings.operation==='merge'){
   if(snapshot.entries.length<2)throw Error('pdf_selection');
   if(snapshot.entries.some(entry=>!entry.info||entry.error))return{ok:false,reason:'pending'};
   return{ok:true,outputs:1,pages:snapshot.entries.reduce((n,e)=>n+e.info!.pages.length,0),order:snapshot.entries.map(e=>e.input.name).join(' → ')};
  }
  const groups=planOperation(selected.info.pages.length,settings),pages=groups.flat(),shown=settings.operation==='rotate'?parsePages(settings.selection,selected.info.pages.length):pages;
  return{ok:true,outputs:groups.length,pages:pages.length,order:shown.slice(0,32).join(' → ')+(shown.length>32?' …':'')};
 }catch(error){return{ok:false,reason:'invalid',code:error instanceof Error?error.message:'pdf_selection'};}
}
