import type {P5Input,P5Format} from './types';
import {P5Error} from './errors';
import {assertLimit} from './limits';
export function newFormatName(name:string):'tsv'|'yaml'|'xlsx'|undefined{const ext=name.split('.').pop()?.toLowerCase();return ext==='yml'?'yaml':ext==='tsv'||ext==='yaml'||ext==='xlsx'?ext:undefined;}
export async function detectP5Format(input:P5Input):Promise<P5Format|undefined>{
  const format=newFormatName(input.name);if(!format)return;const mime=input.type.split(';')[0]!.toLowerCase(),allowed={tsv:['text/tab-separated-values','text/plain'],yaml:['application/yaml','text/yaml','application/x-yaml','text/x-yaml','text/plain'],xlsx:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']};
  if(mime&&mime!=='application/octet-stream'&&!allowed[format].includes(mime))throw new P5Error('type');if(!input.size||input.size!==input.blob.size)throw new P5Error('input');assertLimit(format==='xlsx'?'xlsxSource':format==='yaml'?'structuredSource':'dataSource',input.size);return format;
}
