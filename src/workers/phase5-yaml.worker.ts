import {convertSafeYaml} from '../converters/phase5/yaml';
import type {P5Input,P5Message} from '../core/phase5/types';
import {errorCode,P5Error} from '../core/phase5/errors';
import {assertLimit,P5_LIMITS} from '../core/phase5/limits';
import {safeOutputName} from '../core/files/names';
const scope=self as unknown as {onmessage:((event:MessageEvent<P5Message<{type:'run';input:{input:P5Input;routeId:'yaml-to-json'|'json-to-yaml'}}>>)=>void)|null;postMessage:(value:unknown)=>void};
scope.onmessage=async({data})=>{
  try{
    const {input,routeId}=data.payload.input;assertLimit('structuredSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await input.blob.arrayBuffer());}catch{throw new P5Error('utf8');}
    const result=convertSafeYaml(routeId,text),format=routeId==='yaml-to-json'?'json':'yaml';
    scope.postMessage({...data,payload:{type:'result',value:{kind:'file',name:safeOutputName(input.name,format),format,blob:new Blob([result.text],{type:format==='json'?'application/json;charset=utf-8':'application/yaml;charset=utf-8'}),preview:result.text.slice(0,P5_LIMITS.previewUnits),notices:result.notices}}});
  }catch(error){scope.postMessage({...data,payload:{type:'error',code:errorCode(error)}});}
};
