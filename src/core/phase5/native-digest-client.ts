import type {P5Input,P5RunContext,WorkerPolicy} from './types';
import {P5Error,P5_ERROR_CODES,type P5ErrorCode} from './errors';
import {assertLimit} from './limits';
// Unconfirmed native work is never retried within this page lifetime.
let unknownSettlement=false;
export async function runNativeDigest<I,O>(url:URL,input:I,context:P5RunContext,policy:WorkerPolicy):Promise<O>{
  if(unknownSettlement)throw new P5Error('security');
  const request=input as {input?:P5Input;algorithm?:string};
  if(!request.input||request.algorithm!=='SHA-256'&&request.algorithm!=='SHA-512')throw new P5Error('security');
  assertLimit('hashSource',request.input.size);assertLimit('hashTransient',policy.transientBytes);assertLimit('workerTimeout',policy.timeoutMs);
  if(request.input.size!==request.input.blob.size||policy.transientBytes!==3*request.input.size+2*1024**2)throw new P5Error('security');
  let lease;try{lease=context.budget.reserve('transient',policy.transientBytes,context.taskId);}catch{throw new P5Error('budget');}
  return new Promise<O>((resolve,reject)=>{
    let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined,granted=false,finished=false;
    const identity={taskId:context.taskId,operationId:context.operationId,generation:context.generation};
    const finish=(error?:P5Error,hash?:string)=>{
      if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);context.signal.removeEventListener('abort',abort);
      worker?.removeEventListener('message',message);worker?.removeEventListener('error',failure);worker?.removeEventListener('messageerror',failure);worker?.terminate();lease.release();
      if(context.signal.aborted)reject(new P5Error('cancel'));else if(error)reject(error);else resolve({kind:'report',reportType:'hash',fields:{algorithm:request.algorithm,hash,scope:'original-bytes',bytes:request.input!.size},notices:[]} as O);
    };
    const uncertain=()=>{unknownSettlement=true;context.onStage('hash-refresh-required');};
    const abort=()=>{if(!granted)finish(new P5Error('cancel'));else context.onStage('hash-settling');};
    const failure=()=>{if(granted)uncertain();else finish(new P5Error('structure'));};
    const message=(event:MessageEvent)=>{
      const data=event.data;if(!data||data.taskId!==identity.taskId||data.operationId!==identity.operationId||data.generation!==identity.generation||finished)return;
      const payload=data.payload;
      if(payload?.type==='digest-ready'&&!granted){
        if(context.signal.aborted){abort();return;}granted=true;
        // Mark commitment before posting, including a cancel/start race or post error.
        try{worker!.postMessage({...identity,payload:{type:'digest-grant'}});}catch{uncertain();}
      }else if(payload?.type==='digest-settled'&&granted){
        const expected=request.algorithm==='SHA-256'?64:128;
        if(typeof payload.hash==='string'&&payload.hash.length===expected&&/^[a-f0-9]+$/.test(payload.hash))finish(undefined,payload.hash);
        else finish(new P5Error(P5_ERROR_CODES.includes(payload.code)?payload.code as P5ErrorCode:'structure'));
      }else if(payload?.type==='error'&&!granted)finish(new P5Error(P5_ERROR_CODES.includes(payload.code)?payload.code as P5ErrorCode:'structure'));
    };
    try{
      worker=new Worker(url,{type:'module'});worker.addEventListener('message',message);worker.addEventListener('error',failure);worker.addEventListener('messageerror',failure);context.signal.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{if(granted)uncertain();else finish(new P5Error('timeout'));},policy.timeoutMs);
      worker.postMessage({...identity,payload:{type:'run',input}});
    }catch{if(granted)uncertain();else finish(new P5Error('asset-unavailable'));}
  });
}
