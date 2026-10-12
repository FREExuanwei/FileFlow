import {preflightXlsx,type XlsxEnvelope} from './zip-preflight';
import {P5Error} from '../../../core/phase5/errors';
export interface WorkbookInfo {sheets:readonly {id:string;name:string;visibility:'visible'|'hidden'|'veryHidden'}[];dateSystem:'1900'|'1904'}
const options={type:'array',cellDates:false,cellHTML:false,bookVBA:false} as const;
function cancelled(signal:AbortSignal){if(signal.aborted)throw new P5Error('cancel');}
function compareNames(names:readonly string[]|undefined,envelope:XlsxEnvelope){if(!names||names.length!==envelope.sheets.length||names.some((name,i)=>name!==envelope.sheets[i]!.name))throw new P5Error('structure');}
/** Worker-only entry. No parser import is evaluated until the independent ZIP/XML guard passes. */
export async function inspectWorkbookBytes(bytes:Uint8Array,signal:AbortSignal):Promise<WorkbookInfo>{
  const envelope=await preflightXlsx(bytes,{signal});cancelled(signal);const {read}=await import('xlsx');cancelled(signal);
  const workbook=read(bytes,{...options,bookSheets:true});compareNames(workbook.SheetNames,envelope);
  // bookSheets omits Workbook.Sheets in the pinned reader; visibility comes from validated OOXML.
  return{sheets:envelope.sheets.map(({id,name,visibility})=>({id,name,visibility})),dateSystem:envelope.dateSystem};
}
export async function readSelectedSheet(bytes:Uint8Array,sheetId:string,envelope:XlsxEnvelope,signal:AbortSignal):Promise<unknown>{
  cancelled(signal);const selected=envelope.sheets.find(s=>s.id===sheetId);if(!selected||selected.visibility!=='visible')throw new P5Error('input');
  const {read}=await import('xlsx');cancelled(signal);const workbook=read(bytes,{...options,sheets:[selected.name],dense:true,cellNF:true,cellText:true,cellFormula:true,sheetStubs:true});compareNames(workbook.SheetNames,envelope);
  const metadata=workbook.Workbook?.Sheets;if(!metadata||metadata.length!==envelope.sheets.length||metadata.some((s,i)=>(s.Hidden??0)!==({visible:0,hidden:1,veryHidden:2}[envelope.sheets[i]!.visibility])))throw new P5Error('structure');
  const sheet=workbook.Sheets[selected.name];if(!sheet)throw new P5Error('structure');
  // The reader can omit explicit-n formulas or invent zero for implicit-n missing caches.
  // Preserve source evidence, without retaining or evaluating formula bodies.
  for(const address of envelope.missingFormulaCells?.[sheetId]??[]){const parts=/^([A-Z]+)([0-9]+)$/.exec(address)!;let col=0;for(const c of parts[1]!)col=26*col+c.charCodeAt(0)-64;const row=Number(parts[2])-1;if(sheet['!data']){sheet['!data'][row]??=[];sheet['!data'][row]![col-1]={t:'z',f:''};}else sheet[address]={t:'z',f:''};}
  return sheet;
}
