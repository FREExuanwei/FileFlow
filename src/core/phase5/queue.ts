import type { ResourceBudget,MemoryLease,ReleaseHandle } from '../resources/budget';
import type { ExecutionGate } from '../resources/execution';
import type { P5Input, P5Operation, P5Runner, P5Snapshot,P5Job,P5Result } from './types';
import {P5Error,errorCode} from './errors';
import {assertLimit} from './limits';
import type {ReadyTransfer,ReadyTransferStage} from '../queue/transfer';
let serial=0;
type Dependencies={budget:ResourceBudget;execution:ExecutionGate;run:P5Runner;onSourceRelease?:(input:P5Input)=>void;active?:boolean};
const heavy=(_input:P5Input,operation:P5Operation)=>operation.kind==='hash'||operation.kind==='route'&&/xlsx|yaml/.test(operation.routeId)||operation.kind==='inspect'&&operation.structural;
function checkInput(input:P5Input,operation:P5Operation){
  if(!Number.isSafeInteger(input.size)||input.size<0||input.size!==input.blob.size)throw new P5Error('input');
  const limit=operation.kind==='hash'?'hashSource':operation.kind==='inspect'?'inspectorSource':operation.kind==='json'?'structuredSource':operation.routeId.includes('xlsx')?'xlsxSource':operation.routeId.includes('yaml')?'structuredSource':'dataSource';
  assertLimit(limit,input.size);
}
export class Phase5Queue {
  private snapshot:P5Snapshot={items:[]};private listeners=new Set<()=>void>();private prefix=`phase5-${++serial}`;private next=0;private dead=false;
  private tasks=new Map<string,ReleaseHandle>();private sources=new Map<P5Input,MemoryLease>();private results=new Map<string,MemoryLease>();
  private running=new Map<string,{controller:AbortController;input:P5Input;generation:number;permit:ReleaseHandle}>();
  private unsubscribe:()=>void;
  constructor(private deps:Dependencies) {this.dead=deps.active===false;this.unsubscribe=this.dead?()=>{}:deps.execution.subscribe(()=>this.pump());}
  activate(){if(!this.dead)return;this.dead=false;this.unsubscribe=this.deps.execution.subscribe(()=>this.pump());}
  stageReadyTransfer(id:string):ReadyTransferStage|undefined{
    const before=this.snapshot,job=before.items.find(i=>i.id===id);if(!job?.input||job.status!=='ready'||job.result||this.running.has(id)||before.items.filter(i=>i.input===job.input).length!==1)return;
    const format=job.format??(job.input.name.toLowerCase().endsWith('.csv')?'csv':job.input.name.toLowerCase().endsWith('.json')?'json':undefined);if(format!=='csv'&&format!=='json')return;
    const input=job.input,taskLease=this.tasks.get(id),sourceLease=this.sources.get(input);if(!taskLease||!sourceLease)return;const value:ReadyTransfer={input,taskLease,sourceLease,basename:input.name.replace(/\.[^.]+$/,''),format};let committed=false;
    return{value,commit:()=>{if(this.snapshot!==before||this.running.has(id))throw new P5Error('stale');this.tasks.delete(id);this.sources.delete(input);this.snapshot={...before,items:before.items.filter(i=>i.id!==id),activeId:before.activeId===id?before.items.find(i=>i.id!==id)?.id:before.activeId};committed=true;},rollback:()=>{if(committed){this.snapshot=before;this.tasks.set(id,taskLease);this.sources.set(input,sourceLease);committed=false;}},publish:()=>{if(committed){this.deps.onSourceRelease?.(input);this.publish(this.snapshot.items);}}};
  }
  stageReadyReceive(value:ReadyTransfer,operation:P5Operation):ReadyTransferStage|undefined{
    if(this.dead||this.sources.has(value.input)||operation.kind==='json'&&value.format!=='json'||operation.kind==='route'&&!operation.routeId.startsWith(`${value.format}-to-`))return;
    try{checkInput(value.input,operation);}catch{return;}const before=this.snapshot,id=`${this.prefix}-${++this.next}`,job:P5Job={id,input:value.input,format:value.format,operation,status:'ready',generation:0};let committed=false;
    return{value,commit:()=>{if(this.dead||this.snapshot!==before||this.sources.has(value.input))throw new P5Error('stale');this.tasks.set(id,value.taskLease);this.sources.set(value.input,value.sourceLease);this.snapshot={...before,items:[...before.items,job],activeId:id};committed=true;},rollback:()=>{if(committed){this.snapshot=before;this.tasks.delete(id);this.sources.delete(value.input);committed=false;}},publish:()=>{if(committed)this.publish(this.snapshot.items);}};
  }
  private publish(items:readonly P5Job[],extra:Partial<P5Snapshot>={}){this.snapshot={...this.snapshot,items,...extra};this.reconcile();this.listeners.forEach(listener=>listener());}
  private patch(id:string,update:Partial<P5Job>){this.publish(this.snapshot.items.map(item=>item.id===id?{...item,...update}:item));}
  private reconcile(){
    const inputs=new Set([...this.snapshot.items.flatMap(i=>i.input?[i.input]:[]),...[...this.running.values()].map(r=>r.input)]);
    for(const [input,lease] of this.sources)if(!inputs.has(input)){lease.release();this.sources.delete(input);try{this.deps.onSourceRelease?.(input);}catch{this.snapshot={...this.snapshot,noticeCode:'source-cleanup'};}}
    const ids=new Set([...this.snapshot.items.map(i=>i.id),...this.running.keys()]);
    for(const [id,lease] of this.tasks)if(!ids.has(id)){lease.release();this.tasks.delete(id);}
    const outputs=new Set(this.snapshot.items.filter(i=>i.result).map(i=>i.id));
    for(const [id,lease] of this.results)if(!outputs.has(id)){lease.release();this.results.delete(id);}
  }
  async add(input:P5Input,operation:P5Operation):Promise<string>{
    if(this.dead)throw new P5Error('stale');checkInput(input,operation);const id=`${this.prefix}-${++this.next}`;let task:ReleaseHandle|undefined;
    try{task=this.deps.budget.reserveTask(id);if(!this.sources.has(input))this.sources.set(input,this.deps.budget.reserve('source',input.size,id));this.tasks.set(id,task);}catch{task?.release();throw new P5Error('budget');}
    this.publish([...this.snapshot.items,{id,input,operation,status:'ready',generation:0}],{activeId:this.snapshot.activeId??id});return id;
  }
  configure(id:string,operation:P5Operation){const job=this.snapshot.items.find(i=>i.id===id);if(!job?.input||this.running.has(id)||job.status==='queued')return;checkInput(job.input,operation);this.patch(id,{operation,generation:job.generation+1,status:'ready',result:undefined,errorCode:undefined,stage:undefined});}
  select(id:string){if(this.snapshot.items.some(i=>i.id===id))this.publish(this.snapshot.items,{activeId:id});}
  start(id:string){const job=this.snapshot.items.find(i=>i.id===id);if(this.dead||!job?.input||this.running.has(id)||job.status==='queued')return;this.patch(id,{status:'queued',generation:job.generation+1,result:undefined,errorCode:undefined});this.pump();}
  startAll(){for(const job of this.snapshot.items)if(job.input&&!job.result&&!this.running.has(job.id))this.start(job.id);}
  private pump(){
    if(this.dead)return;
    for(const job of this.snapshot.items){
      if(job.status!=='queued'||!job.input||this.running.has(job.id))continue;
      const permit=this.deps.execution.tryAcquire(job.id,heavy(job.input,job.operation));if(!permit)continue;
      const controller=new AbortController(),input=job.input,generation=job.generation;
      this.running.set(job.id,{controller,input,generation,permit});this.patch(job.id,{status:'processing',stage:'processing'});
      const current=()=>this.snapshot.items.find(i=>i.id===job.id&&i.generation===generation&&!controller.signal.aborted);
      Promise.resolve().then(()=>this.deps.run(input,job.operation,{taskId:job.id,operationId:`${job.id}:${generation}`,generation,signal:controller.signal,budget:this.deps.budget,onStage:stage=>{if(job.operation.kind==='hash'&&stage==='hash-refresh-required')this.publish(this.snapshot.items,{noticeCode:stage});if(current())this.patch(job.id,{stage});}})).then(result=>{
        if(!current())return;
        this.validateResult(result);
        const bytes=result.kind==='file'?result.blob.size:new TextEncoder().encode(JSON.stringify(result.fields)).length;
        let lease:MemoryLease;try{lease=this.deps.budget.reserve('result',bytes,job.id);}catch{throw new P5Error('budget');}
        const invalid=result.kind==='report'&&result.reportType==='validation'&&result.fields.valid===false;
        this.results.set(job.id,lease);this.patch(job.id,{result,status:invalid?'failed':result.notices.length?'warning':'completed',errorCode:invalid?String(result.fields.code??'structure'):undefined,stage:undefined,input:job.operation.kind==='route'?undefined:input});
      }).catch(error=>{if(current())this.patch(job.id,{status:'failed',errorCode:errorCode(error),stage:undefined});}).finally(()=>{this.running.delete(job.id);permit.release();this.reconcile();this.pump();});
    }
  }
  private validateResult(result:P5Result){
    if(result.kind==='file'){assertLimit('dataOutput',result.blob.size);assertLimit('previewUnits',result.preview.length);}else{assertLimit('inspectorReport',new TextEncoder().encode(JSON.stringify(result.fields)).length);}
    if(result.notices.length>100)throw new P5Error('output');
  }
  cancel(id:string){const job=this.snapshot.items.find(i=>i.id===id);if(!job)return;this.running.get(id)?.controller.abort();this.patch(id,{status:'cancelled',generation:job.generation+1,stage:undefined});}
  remove(id:string){this.cancel(id);this.publish(this.snapshot.items.filter(i=>i.id!==id),{activeId:this.snapshot.activeId===id?this.snapshot.items.find(i=>i.id!==id)?.id:this.snapshot.activeId});}
  clear(){for(const id of this.running.keys())this.running.get(id)?.controller.abort();this.publish([],{activeId:undefined,noticeCode:undefined});}
  clearCompleted(){for(const job of this.snapshot.items)if(job.status==='completed'||job.status==='warning')this.remove(job.id);}
  dispose(){this.dead=true;this.unsubscribe();this.clear();this.listeners.clear();}
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
}
