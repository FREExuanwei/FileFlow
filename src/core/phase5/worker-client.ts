import type { P5RunContext, WorkerPolicy } from './types';
import {P5Error,P5_ERROR_CODES,type P5ErrorCode} from './errors';
import {assertLimit} from './limits';
import {runNativeDigest} from './native-digest-client';
export async function runWorker<I,O>(url: URL,input:I,context:P5RunContext,policy:WorkerPolicy):Promise<O> {
  if(context.signal.aborted)throw new P5Error('cancel');
  if(policy.settlement==='native-digest')return runNativeDigest(url,input,context,policy);
  assertLimit('transientBytes',policy.transientBytes);assertLimit('workerTimeout',policy.timeoutMs);
  if(policy.timeoutMs===0)throw new P5Error('timeout');
  let lease;
  try{lease=context.budget.reserve('transient',policy.transientBytes,context.taskId);}catch{throw new P5Error('budget');}
  return new Promise<O>((resolve,reject)=>{
    let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined,settled=false;
    const finish=(error?:P5Error,value?:O)=>{
      if(settled)return;settled=true;if(timer!==undefined)clearTimeout(timer);
      context.signal.removeEventListener('abort',abort);
      worker?.removeEventListener('message',message);worker?.removeEventListener('error',failure);worker?.removeEventListener('messageerror',failure);
      worker?.terminate();lease.release();if(error)reject(error);else resolve(value as O);
    };
    const abort=()=>finish(new P5Error('cancel'));
    const failure=()=>finish(new P5Error('asset-unavailable'));
    const message=(event:MessageEvent)=>{
      const data=event.data;
      if(!data||data.taskId!==context.taskId||data.operationId!==context.operationId||data.generation!==context.generation)return;
      if(context.signal.aborted){abort();return;}
      const payload=data.payload;
      if(payload?.type==='result')finish(undefined,payload.value);
      else if(payload?.type==='error')finish(new P5Error(P5_ERROR_CODES.includes(payload.code)?payload.code as P5ErrorCode:'structure'));
      else if(payload?.type==='stage'&&typeof payload.stage==='string'&&/^[a-z-]{1,40}$/.test(payload.stage))context.onStage(payload.stage);
    };
    try{
      worker=new Worker(url,{type:'module'});worker.addEventListener('message',message);worker.addEventListener('error',failure);worker.addEventListener('messageerror',failure);
      context.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>finish(new P5Error('timeout')),policy.timeoutMs);
      worker.postMessage({taskId:context.taskId,operationId:context.operationId,generation:context.generation,payload:{type:'run',input}});
    }catch{finish(new P5Error('asset-unavailable'));}
  });
}
