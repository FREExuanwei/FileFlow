import type {P5Data} from './types';
import {P5Error} from './errors';
import {utf8Bytes} from './table';
export function stringifyBounded(value:P5Data,indent:0|2,maxBytes:number):string{
  let estimate=0;
  const add=(bytes:number)=>{estimate+=bytes;if(estimate>maxBytes)throw new P5Error('output');};
  const string=(value:string)=>{add(2);for(const char of value){const code=char.charCodeAt(0);add(code<32||code>=0xd800&&code<=0xdfff?6:char==='"'||char==='\\'?2:utf8Bytes(char));}};
  const walk=(value:P5Data,depth:number)=>{
    if(typeof value==='string'){string(value);return;}
    if(value===null||typeof value!=='object'){add(String(value).length);return;}
    const entries=Array.isArray(value)?value.map(item=>[undefined,item] as const):Object.entries(value);
    add(2);for(const [key,item] of entries){add(1+(indent?1+(depth+1)*indent:0));if(key!==undefined){string(key);add(indent?2:1);}walk(item,depth+1);}if(entries.length&&indent)add(1+depth*indent);
  };
  walk(value,0);const text=JSON.stringify(value,null,indent);if(utf8Bytes(text)>maxBytes)throw new P5Error('output');return text;
}
