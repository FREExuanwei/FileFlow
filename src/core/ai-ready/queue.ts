import type { InputFile } from '../conversion/types';
import { ResourceBudget,type MemoryLease,type ReleaseHandle } from '../resources/budget';
import { ExecutionGate } from '../resources/execution';
import { aiSourceName,aiExportBase } from './names';
import { detectAiFormat } from '../../converters/ai-ready/extract';
import { runAiReady } from '../../converters/ai-ready/run';
import { settingsForPreset,validateSettings } from './defaults';
import { TEXT_LIMIT } from './limits';
import { AiError,type AiFormat,type AiSettings,type AiResult,type AiErrorCode,type AiStage,type ExtractedDocument } from './types';
export interface AiJob {id:string;name:string;exportOrdinal:number;size:number;format?:AiFormat;settings:AiSettings;resultSettings?:AiSettings;generation:number;status:'validating'|'ready'|'queued'|'processing'|'completed'|'warning'|'failed'|'cancelled';stage?:AiStage;input?:InputFile;result?:AiResult;error?:AiErrorCode}
export interface AiSnapshot {items:readonly AiJob[];activeId?:string;notice?:AiErrorCode}
type Reservation={task:ReleaseHandle;source:MemoryLease;result?:MemoryLease;scratch?:MemoryLease;execution?:ReleaseHandle};
let queueSerial=0;
export function extractedBytes(document:ExtractedDocument):number {return document.pages.reduce((sum,p)=>sum+2*p.markdown.length+p.lines.reduce((n,l)=>n+2*l.text.length+160,0)+256,0);}
function resultBytes(result:AiResult):number{return extractedBytes(result.extracted)+result.cleaned.markdown.length*2+result.outline.reduce((n,h)=>n+2*h.title.length+160,0)+result.chunks.length*512+result.cleaned.candidates.reduce((n,c)=>n+2*c.text.length+c.occurrences.length*32+128,0)+4096;}
export class AiReadyQueue {
  readonly budget:ResourceBudget;private execution:ExecutionGate;private runner:typeof runAiReady;
  private snapshot:AiSnapshot={items:[]};private listeners=new Set<()=>void>();private reservations=new Map<string,Reservation>();
  private running=new Map<string,AbortController>();private validating?:string;private imports:Promise<void>=Promise.resolve();private epoch=0;private serial=0;private prefix=`ai-${++queueSerial}`;private disposed=false;private unsubscribe:()=>void;
  private exportNames=new Set<string>();
  constructor(dependencies:{budget:ResourceBudget;execution:ExecutionGate;run?:typeof runAiReady}){this.budget=dependencies.budget;this.execution=dependencies.execution;this.runner=dependencies.run??runAiReady;this.unsubscribe=this.execution.subscribe(()=>this.pump());}
  activate=()=>{this.disposed=false;this.unsubscribe();this.unsubscribe=this.execution.subscribe(()=>this.pump());};
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(items:readonly AiJob[],extra:Partial<AiSnapshot>={}){this.snapshot={...this.snapshot,items,...extra};this.listeners.forEach(l=>l());this.cleanup();}
  private patch(id:string,update:Partial<AiJob>){this.publish(this.snapshot.items.map(j=>j.id===id?{...j,...update}:j));}
  private cleanup(){for(const [id,r]of this.reservations)if(!this.snapshot.items.some(j=>j.id===id)&&!this.running.has(id)&&this.validating!==id){r.task.release();r.source.release();r.result?.release();r.scratch?.release();r.execution?.release();this.reservations.delete(id);}}
  select=(id:string)=>{if(this.snapshot.items.some(j=>j.id===id))this.publish(this.snapshot.items,{activeId:id});};
  dismissNotice=()=>this.publish(this.snapshot.items,{notice:undefined});
  add(files:readonly InputFile[]):Promise<void>{
    const epoch=this.epoch,ids:string[]=[];
    for(const input of files){const id=`${this.prefix}-${++this.serial}`;let task:ReleaseHandle|undefined;
      try{task=this.budget.reserveTask(id);const source=this.budget.reserve('source',input.size,id);this.reservations.set(id,{task,source});}
      catch{task?.release();this.publish(this.snapshot.items,{notice:'resource-limit'});break;}
      ids.push(id);const extension=input.name.split('.').at(-1)??'txt';
      const name=aiSourceName(input.name,extension),base=aiExportBase(name);let exportOrdinal=0;
      while(this.exportNames.has((base+(exportOrdinal?` (${exportOrdinal})`:'')).toLowerCase()))exportOrdinal++;
      this.exportNames.add((base+(exportOrdinal?` (${exportOrdinal})`:'')).toLowerCase());
      this.publish([...this.snapshot.items,{id,name,exportOrdinal,size:input.size,input,settings:settingsForPreset('balanced'),generation:0,status:'validating'}],{activeId:this.snapshot.activeId??id});
    }
    const next=async()=>{for(const id of ids){if(epoch!==this.epoch)break;const job=this.snapshot.items.find(j=>j.id===id);if(!job?.input)continue;this.validating=id;
      try{const format=await detectAiFormat(job.input);if(epoch===this.epoch&&this.snapshot.items.some(j=>j.id===id))this.patch(id,{format,name:aiSourceName(job.name,format),status:'ready'});}
      catch(error){if(epoch===this.epoch)this.patch(id,{status:'failed',input:undefined,error:error instanceof AiError?error.code:'unsupported'});}
      finally{this.validating=undefined;if(!this.snapshot.items.find(j=>j.id===id)?.input)this.reservations.get(id)?.source.release();this.cleanup();}
    }};
    this.imports=this.imports.then(next,next);return this.imports;
  }
  configure(id:string,settings:AiSettings){const job=this.snapshot.items.find(j=>j.id===id);if(!job||['processing','queued','validating'].includes(job.status))return;validateSettings(settings);this.patch(id,{settings:structuredClone(settings),generation:job.generation+1,status:'ready',error:undefined});}
  start=(id:string)=>{const job=this.snapshot.items.find(j=>j.id===id);if(!job?.format||(!job.input&&!job.result)||['processing','queued','validating'].includes(job.status)||this.running.has(id))return;this.patch(id,{status:'queued',generation:job.generation+1,error:undefined});this.pump();};
  startAll=()=>{for(const job of this.snapshot.items)if(job.status==='ready')this.start(job.id);};
  cancel=(id:string)=>{this.running.get(id)?.abort();const job=this.snapshot.items.find(j=>j.id===id);if(job&&['queued','processing'].includes(job.status))this.patch(id,{status:'cancelled',stage:undefined,generation:job.generation+1});};
  remove=(id:string)=>{this.cancel(id);const items=this.snapshot.items.filter(j=>j.id!==id);this.publish(items,{activeId:this.snapshot.activeId===id?items[0]?.id:this.snapshot.activeId});};
  clear=()=>{this.epoch++;this.exportNames.clear();this.running.forEach(c=>c.abort());this.publish([],{activeId:undefined,notice:undefined});};
  clearCompleted=()=>{for(const job of [...this.snapshot.items])if(['completed','warning'].includes(job.status))this.remove(job.id);};
  dispose=()=>{this.disposed=true;this.unsubscribe();this.clear();};
  private pump(){if(this.disposed||this.running.size)return;const job=this.snapshot.items.find(j=>j.status==='queued');if(!job)return;
    const permission=this.execution.tryAcquire(job.id,true);if(!permission)return;const reservation=this.reservations.get(job.id)!;reservation.execution=permission;
    const controller=new AbortController();this.running.set(job.id,controller);this.patch(job.id,{status:'processing'});void this.execute(job,controller,reservation);
  }
  private async execute(job:AiJob,controller:AbortController,reservation:Reservation){
    const current=()=>!controller.signal.aborted&&this.snapshot.items.some(j=>j.id===job.id&&j.generation===job.generation);
    let committed=false;
    try{
      const initial=job.result?extractedBytes(job.result.extracted)*2+4096:(job.input?.size??0)*2+4096;
      reservation.scratch=this.budget.reserve('result',initial,job.id);
      const result=await this.runner(job.input,job.result?.extracted,job.settings,{signal:controller.signal,generation:job.generation,onStage:stage=>{if(current())this.patch(job.id,{stage});},onExtracted:document=>{
        const units=document.pages.reduce((n,p)=>n+p.markdown.length,0);if(units>TEXT_LIMIT)throw new AiError('text-limit');
        const upper=Math.min(TEXT_LIMIT,units*2+document.pages.length*12);
        let lineCount=document.pages.length;for(const page of document.pages)for(const newline of page.markdown.matchAll(/\r\n|\r|\n/g)){void newline;lineCount++;}
        reservation.scratch!.resize(extractedBytes(document)*2+upper*4+document.pages.reduce((n,p)=>n+p.lines.length,0)*256+lineCount*32+8192);
      }});
      if(!current())return;
      reservation.scratch.resize(resultBytes(result));reservation.result?.release();reservation.result=reservation.scratch;reservation.scratch=undefined;committed=true;
      const warning=!!(result.extracted.warnings.length||result.cleaned.warnings.length||result.chunks.some(c=>c.warnings.length));
      this.patch(job.id,{result,resultSettings:structuredClone(job.settings),input:undefined,status:warning?'warning':'completed',stage:undefined,error:undefined});
    }catch(error){if(current())this.patch(job.id,{status:'failed',stage:undefined,error:error instanceof AiError?error.code:error instanceof Error&&error.message==='resource-limit'?'resource-limit':'worker-failed'});}
    finally{reservation.scratch?.release();reservation.scratch=undefined;if(committed)reservation.source.release();this.running.delete(job.id);reservation.execution?.release();reservation.execution=undefined;this.cleanup();this.pump();}
  }
}
