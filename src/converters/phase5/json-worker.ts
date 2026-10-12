import type {P5Input,P5RunContext,P5Result} from '../../core/phase5/types';
import type {JsonAction} from './json';
import {P5Error,P5_ERROR_CODES,type P5ErrorCode} from '../../core/phase5/errors';
import {assertLimit,P5_LIMITS} from '../../core/phase5/limits';
export interface JsonWorkerSession {run(action:JsonAction,context:P5RunContext):Promise<P5Result>;dispose():void}
export async function openJsonWorkerSession(input:P5Input,context:P5RunContext):Promise<JsonWorkerSession>{
  if(context.signal.aborted)throw new P5Error('cancel');assertLimit('structuredSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');
  let lease;try{lease=context.budget.reserve('transient',P5_LIMITS.structuredTransient,context.taskId);}catch{throw new P5Error('budget');}
  let worker:Worker;try{worker=new Worker(new URL('../../workers/phase5-data.worker.ts',import.meta.url),{type:'module'});}catch{lease.release();throw new P5Error('asset-unavailable');}
  let disposed=false,lastGeneration=context.generation;
  let pending:{context:P5RunContext;ready:boolean;resolve:(value:unknown)=>void;reject:(error:P5Error)=>void;cleanup:()=>void}|undefined;
  const finish=(error?:P5Error,value?:unknown)=>{const current=pending;if(!current)return;pending=undefined;current.cleanup();if(error)current.reject(error);else current.resolve(value);};
  const dispose=(error=new P5Error('stale'))=>{if(disposed)return;disposed=true;finish(error);worker.removeEventListener('message',message);worker.removeEventListener('error',failure);worker.removeEventListener('messageerror',failure);worker.terminate();lease.release();};
  const failure=()=>dispose(new P5Error('asset-unavailable'));
  const message=(event:MessageEvent)=>{
    const data=event.data,current=pending;if(!current||!data||data.taskId!==current.context.taskId||data.operationId!==current.context.operationId||data.generation!==current.context.generation)return;
    if(current.context.signal.aborted){dispose(new P5Error('cancel'));return;}
    if(data.payload?.type==='error'){dispose(new P5Error(P5_ERROR_CODES.includes(data.payload.code)?data.payload.code as P5ErrorCode:'structure'));return;}
    if(current.ready&&data.payload?.type==='ready')finish();else if(!current.ready&&data.payload?.type==='result')finish(undefined,data.payload.value);
  };
  worker.addEventListener('message',message);worker.addEventListener('error',failure);worker.addEventListener('messageerror',failure);
  const send=(payload:unknown,next:P5RunContext,ready=false):Promise<unknown>=>{
    if(disposed||next.taskId!==context.taskId||next.budget!==context.budget||next.generation<lastGeneration)return Promise.reject(new P5Error('stale'));
    if(next.signal.aborted){dispose(new P5Error('cancel'));return Promise.reject(new P5Error('cancel'));}
    lastGeneration=next.generation;finish(new P5Error('stale'));
    return new Promise((resolve,reject)=>{
      const abort=()=>dispose(new P5Error('cancel')),timer=setTimeout(()=>dispose(new P5Error('timeout')),P5_LIMITS.workerTimeout);
      next.signal.addEventListener('abort',abort,{once:true});pending={context:next,ready,resolve,reject,cleanup:()=>{clearTimeout(timer);next.signal.removeEventListener('abort',abort);}};
      try{worker.postMessage({taskId:next.taskId,operationId:next.operationId,generation:next.generation,payload});}catch{dispose(new P5Error('asset-unavailable'));}
    });
  };
  await send({type:'json-open',input},context,true);
  return{run:async(action,next)=>(await send({type:'json-action',action},next)) as P5Result,dispose:()=>dispose()};
}
