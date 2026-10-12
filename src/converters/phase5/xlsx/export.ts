import type {NormalizedSheet} from './normalize';
import type {P5Notice,P5Primitive} from '../../../core/phase5/types';
import {buildSafeRecords,serializeDelimited} from '../../../core/phase5/table';
import {stringifyBounded} from '../../../core/phase5/serialize';
import {P5_LIMITS,assertLimit} from '../../../core/phase5/limits';
import {P5Error} from '../../../core/phase5/errors';
export function exportXlsxSheet(sheet:NormalizedSheet,target:'csv'|'json',headers:'first-row'|'generated'):{text:string;notices:P5Notice[];rows:number;columns:number}{
  if(!['csv','json'].includes(target)||!['first-row','generated'].includes(headers))throw new P5Error('input');
  const start=sheet.rows.findIndex(row=>row.some(cell=>cell.raw!==null&&cell.raw!==''));if(start<0)throw new P5Error('structure');const columns=sheet.rows[start]!.length;
  assertLimit('xlsxRows',sheet.rows.length);assertLimit('xlsxColumns',columns);assertLimit('xlsxCells',sheet.rows.length*columns);
  if(!columns||sheet.rows.some(row=>row.length!==columns))throw new P5Error('structure');
  const notices:P5Notice[]=[...sheet.notices,{code:'xlsx-single-sheet'}];if(start)notices.push({code:'xlsx-leading-empty-rows',count:start});
  let names:string[],dataStart=start;
  if(headers==='generated')names=Array.from({length:columns},(_,i)=>`column_${i+1}`);
  else{const values=sheet.rows[start]!.map(c=>c.raw);if(values.some(v=>typeof v!=='string'||!v.trim())||new Set(values).size!==values.length)throw new P5Error('headers');names=values as string[];dataStart++;}
  const rows:P5Primitive[][]=[];let dateCount=0;
  for(const row of sheet.rows.slice(dataStart))rows.push(row.map(cell=>{
    if(cell.dateStyled){dateCount++;if(target==='csv'&&cell.display===undefined)throw new P5Error('date-display');}
    return target==='json'||cell.raw===null?cell.raw:cell.display!==undefined&&cell.display!==String(cell.raw)?cell.display:cell.raw;
  }));
  const table={headers:names,rows};let text:string;
  if(target==='json'){text=stringifyBounded(Array.from(buildSafeRecords(table)),2,P5_LIMITS.xlsxOutput);if(dateCount)notices.push({code:'xlsx-json-date-serial',count:dateCount});}
  else{const result=serializeDelimited(table,',',P5_LIMITS.xlsxOutput);text=result.text;notices.push(...result.notices);}
  return{text,notices,rows:rows.length,columns};
}
