import type {P5Table,P5Primitive,P5Notice} from './types';
import Papa from 'papaparse';
import {P5Error} from './errors';
import {assertLimit} from './limits';
export function utf8Bytes(text:string):number{
  let bytes=0;for(const char of text){const code=char.codePointAt(0)!;bytes+=code<128?1:code<2048?2:code<65536?3:4;}return bytes;
}
export function validateTable(table:P5Table):void{
  assertLimit('dataRows',table.rows.length);assertLimit('dataColumns',table.headers.length);assertLimit('dataCells',(table.rows.length+1)*table.headers.length);
  if(!table.headers.length||table.headers.some(h=>!h.trim())||new Set(table.headers).size!==table.headers.length)throw new P5Error('headers');
  if(table.rows.some(row=>row.length!==table.headers.length||row.some(value=>value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))))throw new P5Error('structure');
}
export function buildSafeRecords(table:P5Table):ReadonlyArray<Readonly<Record<string,P5Primitive>>>{
  validateTable(table);return table.rows.map(row=>{const record:Record<string,P5Primitive>=Object.create(null);table.headers.forEach((header,i)=>{record[header]=row[i]??null;});return record;});
}
export function neutralizeCell(value:P5Primitive):{value:P5Primitive;changed:boolean}{
  const changed=typeof value==='string'&&(/^[\s\uFEFF]*[=+\-@]/.test(value)||/^[\t\r\n]/.test(value));return{value:changed?"'"+value:value,changed};
}
export function serializeDelimited(table:P5Table,delimiter:','|'\t',maxBytes:number):{text:string;notices:P5Notice[]}{
  validateTable(table);let estimate=0,count=0;
  const rows=[table.headers,...table.rows].map(row=>row.map(cell=>{
    const safe=neutralizeCell(cell);if(safe.changed)count++;const text=safe.value===null?'':String(safe.value);
    // Conservative upper bound: quote every cell and double each quote, even if Papa can omit them.
    estimate+=utf8Bytes(text)+2+(text.match(/"/g)?.length??0)+1;
    if(estimate>maxBytes)throw new P5Error('output');return safe.value;
  }));
  estimate+=rows.length*2;if(estimate>maxBytes)throw new P5Error('output');
  const text=Papa.unparse(rows,{delimiter,newline:'\r\n',escapeFormulae:false});if(utf8Bytes(text)>maxBytes)throw new P5Error('output');
  return{text,notices:count?[{code:'formula-neutralized',count}]:[]};
}
export function tablePreview(table:P5Table):string{return [table.headers.slice(0,20),...table.rows.slice(0,20).map(row=>row.slice(0,20))].map(row=>row.map(value=>String(value??'').slice(0,200)).join(' | ')).join('\n');}
