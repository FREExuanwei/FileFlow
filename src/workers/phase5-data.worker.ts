import {convertP5Data,type DataRoute} from '../converters/phase5/data';
import type {P5Input,P5Message} from '../core/phase5/types';
import {errorCode,P5Error} from '../core/phase5/errors';
import {assertLimit} from '../core/phase5/limits';
import {safeOutputName} from '../core/files/names';
import {createJsonSession,type JsonAction,type JsonCoreSession} from '../converters/phase5/json';
type Payload={type:'run';input:{input:P5Input;routeId:DataRoute}}|{type:'json-open';input:P5Input}|{type:'json-action';action:JsonAction};
const scope=self as unknown as {onmessage:((event:MessageEvent<P5Message<Payload>>)=>void)|null;postMessage:(value:unknown)=>void};
let jsonSession:JsonCoreSession|undefined,jsonName='converted.json';
scope.onmessage=async({data})=>{
  try{
    const reply=(payload:unknown)=>scope.postMessage({taskId:data.taskId,operationId:data.operationId,generation:data.generation,payload});
    if(data.payload.type==='json-open'){
      const input=data.payload.input;assertLimit('structuredSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');jsonSession?.dispose();
      let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await input.blob.arrayBuffer());}catch{throw new P5Error('utf8');}
      jsonSession=createJsonSession(text);jsonName=safeOutputName(input.name,'json');reply({type:'ready'});return;
    }
    if(data.payload.type==='json-action'){
      if(!jsonSession)throw new P5Error('stale');const result=jsonSession.run(data.payload.action);reply({type:'result',value:result.kind==='file'?{...result,name:jsonName}:result});return;
    }
    const {input,routeId}=data.payload.input;assertLimit('dataSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await input.blob.arrayBuffer());}catch{throw new P5Error('utf8');}
    const converted=convertP5Data(routeId,text),format=routeId==='tsv-to-csv'?'csv':routeId==='tsv-to-json'?'json':'tsv';
    const value={kind:'file',name:safeOutputName(input.name,format),format,blob:new Blob([converted.text],{type:format==='json'?'application/json;charset=utf-8':format==='csv'?'text/csv;charset=utf-8':'text/tab-separated-values;charset=utf-8'}),preview:converted.preview,notices:converted.notices,rows:converted.rows,columns:converted.columns};
    scope.postMessage({taskId:data.taskId,operationId:data.operationId,generation:data.generation,payload:{type:'result',value}});
  }
  catch(error){scope.postMessage({...data,payload:{type:'error',code:errorCode(error)}});}
};
