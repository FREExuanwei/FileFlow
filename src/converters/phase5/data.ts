import type {P5Notice,P5Table,P5Data,P5Primitive} from '../../core/phase5/types';
import Papa from 'papaparse';
import {P5_LIMITS,assertLimit} from '../../core/phase5/limits';
import {parseSafeJson} from '../../core/phase5/safe-json';
import {P5Error} from '../../core/phase5/errors';
import {buildSafeRecords,serializeDelimited,utf8Bytes,validateTable,tablePreview} from '../../core/phase5/table';
import {stringifyBounded} from '../../core/phase5/serialize';
export type DataRoute='csv-to-tsv'|'tsv-to-csv'|'tsv-to-json'|'json-to-tsv';
export function convertP5Data(routeId:DataRoute,text:string):{text:string;notices:P5Notice[];rows:number;columns:number;preview:string}{
  assertLimit('dataSource',utf8Bytes(text));text=text.replace(/^\uFEFF/,'');let table:P5Table;
  if(routeId==='json-to-tsv'){
    const {value}=parseSafeJson(text,P5_LIMITS);if(!Array.isArray(value)||!value.length)throw new P5Error('structure');assertLimit('dataRows',value.length);
    const fields=new Set<string>();
    for(const row of value){if(!row||typeof row!=='object'||Array.isArray(row))throw new P5Error('structure');for(const [key,item] of Object.entries(row)){if(item!==null&&typeof item==='object')throw new P5Error('structure');fields.add(key);assertLimit('dataColumns',fields.size);}}
    const headers=[...fields];assertLimit('dataCells',(value.length+1)*headers.length);
    table={headers,rows:value.map(row=>headers.map(key=>Object.hasOwn(row as object,key)?(row as Record<string,P5Data>)[key] as P5Primitive:null))};
  }else{
    if(!['csv-to-tsv','tsv-to-csv','tsv-to-json'].includes(routeId))throw new P5Error('type');
    const parsed=Papa.parse<string[]>(text,{delimiter:routeId==='csv-to-tsv'?',':'\t',header:false,skipEmptyLines:'greedy'});
    if(parsed.errors.length)throw new P5Error('structure');const [headers,...rows]=parsed.data;if(!headers)throw new P5Error('headers');table={headers,rows};
  }
  validateTable(table);
  const result=routeId==='tsv-to-json'?{text:stringifyBounded(buildSafeRecords(table) as P5Data,2,P5_LIMITS.dataOutput),notices:[]}:serializeDelimited(table,routeId==='tsv-to-csv'?',':'\t',P5_LIMITS.dataOutput);
  return{...result,rows:table.rows.length,columns:table.headers.length,preview:tablePreview(table)};
}
