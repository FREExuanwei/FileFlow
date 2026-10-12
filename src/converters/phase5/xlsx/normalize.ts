import type {P5Primitive,P5Notice} from '../../../core/phase5/types';
import type {XlsxEnvelope} from './zip-preflight';
import {SSF} from 'xlsx';
import type {WorkSheet,CellObject} from 'xlsx';
import {P5Error} from '../../../core/phase5/errors';
import {assertLimit} from '../../../core/phase5/limits';
export interface NormalizedCell{raw:P5Primitive;type:'number'|'string'|'boolean'|'blank'|'error';display?:string;numberFormat?:string;dateStyled:boolean;formulaCache:'none'|'cached'|'missing'}
export interface NormalizedSheet{sheetId:string;dateSystem:'1900'|'1904';rows:readonly(readonly NormalizedCell[])[];notices:P5Notice[]}
function blank(missing=false):NormalizedCell{return{raw:null,type:'blank',dateStyled:false,formulaCache:missing?'missing':'none'};}
const errorText:Record<number,string>={0:'#NULL!',7:'#DIV/0!',15:'#VALUE!',23:'#REF!',29:'#NAME?',36:'#NUM!',42:'#N/A',43:'#GETTING_DATA'};
function coord(text:string){const match=/^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(text);if(!match)throw new P5Error('structure');let c=0;for(const ch of match[1]!)c=c*26+ch.charCodeAt(0)-64;return{r:Number(match[2])-1,c:c-1};}
function label(column:number){let output='';for(let c=column+1;c>0;c=Math.floor((c-1)/26))output=String.fromCharCode(65+(c-1)%26)+output;return output;}
export function normalizeSheet(raw:unknown,envelope:XlsxEnvelope,sheetId:string):NormalizedSheet{
  const bounds=envelope.sheets.find(s=>s.id===sheetId);if(!bounds||bounds.visibility!=='visible'||!raw||typeof raw!=='object')throw new P5Error('input');const sheet=raw as WorkSheet;
  assertLimit('xlsxRows',bounds.lastRow);assertLimit('xlsxColumns',bounds.lastColumn);assertLimit('xlsxCells',bounds.lastRow*bounds.lastColumn);
  if(sheet['!ref']){const refs=sheet['!ref'].split(':');if(refs.length>2)throw new P5Error('structure');const start=coord(refs[0]!),end=coord(refs[1]??refs[0]!);if(start.r>end.r||start.c>end.c||end.r>=bounds.lastRow||end.c>=bounds.lastColumn)throw new P5Error('structure');}
  const counters=new Map<string,number>(),count=(code:string)=>counters.set(code,(counters.get(code)??0)+1),suppressed=new Set<number>();let mergeArea=0;
  for(const merge of sheet['!merges']??[]){const {s,e}=merge;if(![s.r,s.c,e.r,e.c].every(Number.isSafeInteger)||s.r<0||s.c<0||e.r<s.r||e.c<s.c||e.r>=bounds.lastRow||e.c>=bounds.lastColumn)throw new P5Error('structure');mergeArea+=(e.r-s.r+1)*(e.c-s.c+1);assertLimit('xlsxCells',mergeArea);count('xlsx-merged');for(let r=s.r;r<=e.r;r++)for(let c=s.c;c<=e.c;c++)if(r!==s.r||c!==s.c)suppressed.add(r*bounds.lastColumn+c);}
  for(const row of sheet['!rows']??[])if(row?.hidden)count('xlsx-hidden-rows');for(const col of sheet['!cols']??[])if(col?.hidden)count('xlsx-hidden-columns');
  let populated=0,missing=0;const rows:NormalizedCell[][]=[];
  const cellValue=(cell:CellObject|undefined):NormalizedCell=>{
    if(!cell)return blank();const formula=typeof cell.f==='string'||typeof cell.F==='string';if(formula&&cell.v===undefined){missing++;count('xlsx-formula-missing');return blank(true);}
    if(cell.v===undefined||cell.t==='z')return blank();let type:NormalizedCell['type'],value:P5Primitive;
    if(cell.t==='n'&&typeof cell.v==='number'){if(!Number.isFinite(cell.v)||Number.isInteger(cell.v)&&!Number.isSafeInteger(cell.v))throw new P5Error('precision');type='number';value=cell.v;}
    else if((cell.t==='s'||(cell.t as string)==='str')&&typeof cell.v==='string'){type='string';value=cell.v;assertLimit('xlsxCellUnits',value.length);}
    else if(cell.t==='b'&&typeof cell.v==='boolean'){type='boolean';value=cell.v;}
    else if(cell.t==='e'&&typeof cell.v==='number'){type='error';value=errorText[cell.v]??'#ERROR!';count('xlsx-errors');}
    else throw new P5Error('structure');
    const format=typeof cell.z==='string'?cell.z:undefined;if(format)assertLimit('xlsxCellUnits',format.length);
    const dateStyled=type==='number'&&Boolean(format&&SSF.is_date(format));let display=typeof cell.w==='string'?cell.w:undefined;if(display!==undefined)assertLimit('xlsxCellUnits',display.length);
    if(display===undefined&&format&&type==='number'){try{display=String(SSF.format(format,value,{date1904:envelope.dateSystem==='1904'}));assertLimit('xlsxCellUnits',display.length);}catch{display=undefined;}}
    if(dateStyled)count(`xlsx-dates-${envelope.dateSystem}`);if(formula)count('xlsx-formula-cached');if(value!==null&&value!=='')populated++;
    return{raw:value,type,dateStyled,formulaCache:formula?'cached':'none',...(display===undefined?{}:{display}),...(format?{numberFormat:format}:{})};
  };
  for(let r=0;r<bounds.lastRow;r++){const row:NormalizedCell[]=[];for(let c=0;c<bounds.lastColumn;c++)row.push(suppressed.has(r*bounds.lastColumn+c)?blank():cellValue(sheet['!data']?sheet['!data'][r]?.[c]:sheet[`${label(c)}${r+1}`] as CellObject|undefined));rows.push(row);}
  if(missing&&!populated)throw new P5Error('structure');
  return{sheetId,dateSystem:envelope.dateSystem,rows,notices:[...counters].map(([code,count])=>({code,count}))};
}
