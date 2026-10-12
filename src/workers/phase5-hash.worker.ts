import {digestBytes} from '../converters/phase5/hash-core';
import {errorCode,P5Error} from '../core/phase5/errors';
import {assertLimit} from '../core/phase5/limits';
import type {P5Input,P5Message} from '../core/phase5/types';
type Request={type:'run';input:{input:P5Input;algorithm:'SHA-256'|'SHA-512'}}|{type:'digest-grant'};
const scope=self as unknown as {onmessage:((event:MessageEvent<P5Message<Request>>)=>void)|null;postMessage:(value:unknown)=>void};
let identity:{taskId:string;operationId:string;generation:number}|undefined,bytes:Uint8Array|undefined,algorithm:'SHA-256'|'SHA-512',begun=false;
scope.onmessage=async({data})=>{
  if(data.payload.type==='run'){
    if(identity)return;identity={taskId:data.taskId,operationId:data.operationId,generation:data.generation};
    try{const input=data.payload.input.input;algorithm=data.payload.input.algorithm;assertLimit('hashSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');bytes=new Uint8Array(await input.blob.arrayBuffer());scope.postMessage({...identity,payload:{type:'digest-ready'}});}
    catch(error){scope.postMessage({...identity,payload:{type:'error',code:errorCode(error)}});}return;
  }
  if(!identity||begun||!bytes||data.taskId!==identity.taskId||data.operationId!==identity.operationId||data.generation!==identity.generation)return;
  begun=true;try{const hash=await digestBytes(bytes,algorithm);bytes=undefined;scope.postMessage({...identity,payload:{type:'digest-settled',hash}});}
  catch(error){bytes=undefined;scope.postMessage({...identity,payload:{type:'digest-settled',code:errorCode(error)}});}
};
