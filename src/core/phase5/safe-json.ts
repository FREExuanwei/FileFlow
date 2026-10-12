import type {SafeJson,P5Data} from './types';
import {P5Error} from './errors';
export function parseSafeJson(text:string,limits:{depth:number;nodes:number;scalarUnits:number}):SafeJson {
  let i=0,nodes=0,depth=0;
  const fail=():never=>{throw new P5Error('structure');};
  const count=()=>{if(++nodes>limits.nodes)throw new P5Error('size');};
  const space=()=>{while(i<text.length&&/[\x20\t\r\n]/.test(text[i]!))i++;};
  const string=():string=>{
    if(text[i++]!=='"')return fail();const chars:string[]=[];
    while(i<text.length){let char=text[i++]!;if(char==='"')return chars.join('');
      if(char==='\\'){
        char=text[i++]??'';
        const simple:Record<string,string>={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};
        if(Object.hasOwn(simple,char))char=simple[char]!;
        else if(char==='u'){const hex=text.slice(i,i+4);if(!/^[a-fA-F0-9]{4}$/.test(hex))return fail();char=String.fromCharCode(parseInt(hex,16));i+=4;}
        else return fail();
      }else if(char.charCodeAt(0)<32)return fail();
      if(chars.length>=limits.scalarUnits)throw new P5Error('size');chars.push(char);
    }return fail();
  };
  const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const value=(level:number):void=>{
    space();count();const char=text[i];
    if(char==='{'||char==='['){const current=level+1;if(current>limits.depth)throw new P5Error('size');depth=Math.max(depth,current);i++;space();const end=char==='{'?'}':']';
      if(text[i]===end){i++;return;}const keys=new Set<string>();
      while(i<text.length){
        if(char==='{'){space();const key=string();count();if(keys.has(key))throw new P5Error('json-duplicate-key');keys.add(key);space();if(text[i++]!==':')return fail();}
        value(current);space();if(text[i]===end){i++;return;}if(text[i++]!==',')return fail();
      }return fail();
    }
    if(char==='"'){string();return;}
    for(const literal of ['true','false','null'])if(text.startsWith(literal,i)){i+=literal.length;return;}
    number.lastIndex=i;const match=number.exec(text);if(!match)return fail();i=number.lastIndex;
    if(match[0].length>limits.scalarUnits)throw new P5Error('size');const numeric=Number(match[0]);
    if(!Number.isFinite(numeric)||Number.isInteger(numeric)&&!Number.isSafeInteger(numeric))throw new P5Error('precision');
  };
  value(0);space();if(i!==text.length)fail();
  const rebuild=(data:P5Data):P5Data=>{
    if(Array.isArray(data))return data.map(rebuild);
    if(data&&typeof data==='object'){const safe:Record<string,P5Data>=Object.create(null);for(const [key,item] of Object.entries(data))safe[key]=rebuild(item);return safe;}
    return data;
  };
  try{return{value:rebuild(JSON.parse(text) as P5Data),nodes,depth};}catch{throw new P5Error('structure');}
}
