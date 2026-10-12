import type {InputFile} from '../conversion/types';
import {ResourceBudget,type MemoryLease,type ReleaseHandle} from '../resources/budget';
import {ExecutionGate} from '../resources/execution';
import {validatePdfInput} from './plan';
import {PDF_TOOLS_LIMITS,type PdfInfo,type PdfSettings,type PdfOutput,type PdfRequest,type PdfResponse} from './types';
export interface PdfEntry {id:string;input:InputFile;info?:PdfInfo;error?:string}
export interface PdfSnapshot {entries:readonly PdfEntry[];selected?:string;settings:PdfSettings;outputs:readonly PdfOutput[];status:'idle'|'queued'|'inspecting'|'processing'|'completed'|'cancelled'|'failed';progress:number;error?:string}
export interface PdfDependencies {budget:ResourceBudget;execution:ExecutionGate;run:(request:PdfRequest,signal:AbortSignal,progress:(value:number)=>void)=>Promise<PdfResponse>}
const defaultSettings:PdfSettings={operation:'extract',selection:'1',splitSize:10,rotation:90};
export class PdfToolsStore{
 private snapshot:PdfSnapshot={entries:[],settings:defaultSettings,outputs:[],status:'idle',progress:0};private listeners=new Set<()=>void>();private serial=0;
 private sources=new Map<string,{source:MemoryLease;task:ReleaseHandle}>();private resultLease?:MemoryLease;private active?:{controller:AbortController;ids:string[]};private scheduled?:ReturnType<typeof setTimeout>;
 constructor(private readonly deps:PdfDependencies){}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.snapshot;
 private publish(update:Partial<PdfSnapshot>){this.snapshot={...this.snapshot,...update};this.cleanup();this.listeners.forEach(listener=>listener());}
 private cleanup(){for(const[id,leases]of this.sources)if(!this.snapshot.entries.some(entry=>entry.id===id)&&!this.active?.ids.includes(id)){leases.source.release();leases.task.release();this.sources.delete(id);}}
 private error(error:unknown){return error instanceof Error&&(/^(pdf_[a-z_]+|resource-limit)$/.test(error.message))?error.message:'pdf_invalid';}
 private busy(){return Boolean(this.active);}
 select=(id:string)=>{const entry=this.snapshot.entries.find(entry=>entry.id===id);if(entry&&!this.busy())this.publish({selected:id,settings:{...this.snapshot.settings,selection:entry.info?.pages.length?`1-${entry.info.pages.length}`:'1'},error:undefined});};
 configure=(update:Partial<PdfSettings>)=>{if(!this.busy())this.publish({settings:{...this.snapshot.settings,...update},status:'idle',error:undefined});};
 move=(id:string,delta:number)=>{if(this.busy()||![-1,1].includes(delta))return;const entries=[...this.snapshot.entries],index=entries.findIndex(entry=>entry.id===id),target=index+delta;if(index<0||target<0||target>=entries.length)return;[entries[index],entries[target]]=[entries[target]!,entries[index]!];this.publish({entries,status:'idle'});};
 remove=(id:string)=>{if(this.busy())return;const entries=this.snapshot.entries.filter(entry=>entry.id!==id);this.publish({entries,selected:this.snapshot.selected===id?entries[0]?.id:this.snapshot.selected,status:'idle',error:undefined});if(entries[0]&&this.snapshot.selected===entries[0].id)this.select(entries[0].id);};
 async add(inputs:readonly InputFile[]):Promise<void>{
  if(this.busy()){this.publish({error:'pdf_busy'});return;}if(!inputs.length)return;
  const admitted:PdfEntry[]=[];
  try{if(inputs.reduce((sum,input)=>sum+input.size,0)+this.snapshot.entries.reduce((sum,entry)=>sum+entry.input.size,0)>PDF_TOOLS_LIMITS.totalBytes)throw new Error('pdf_total_limit');
   for(const input of inputs){validatePdfInput(input);const id=`pdf-tools-${++this.serial}`;const task=this.deps.budget.reserveTask(id);let source:MemoryLease;try{source=this.deps.budget.reserve('source',input.size,id);}catch(error){task.release();throw error;}this.sources.set(id,{source,task});admitted.push({id,input});}
  }catch(error){admitted.forEach(entry=>{this.sources.get(entry.id)?.source.release();this.sources.get(entry.id)?.task.release();this.sources.delete(entry.id);});this.publish({error:this.error(error)});return;}
  this.publish({entries:[...this.snapshot.entries,...admitted],selected:this.snapshot.selected??admitted[0]?.id,error:undefined});
  // Return to the platform importer before inspecting, so its retained IPC chunks
  // and temporary File-copy lease can be released before PDF parse allocations.
  if(!this.scheduled)this.scheduled=setTimeout(()=>{this.scheduled=undefined;void this.inspect();},0);
 }
 inspect=async()=>{if(this.busy())return;const pending=this.snapshot.entries.filter(entry=>!entry.info);if(!pending.length)return;
  await this.job(pending,'inspecting',async(signal,progress)=>{
   for(const entry of pending){if(signal.aborted)throw new Error('pdf_cancelled');try{const response=await this.deps.run({kind:'inspect',inputs:[entry.input],settings:this.snapshot.settings},signal,progress);if(signal.aborted)throw new Error('pdf_cancelled');const info=response.info[0];if(!info)throw new Error('pdf_invalid');if(this.snapshot.entries.reduce((sum,item)=>sum+(item.id===entry.id?info.pages.length:item.info?.pages.length??0),0)>PDF_TOOLS_LIMITS.pages)throw new Error('pdf_page_limit');this.publish({entries:this.snapshot.entries.map(item=>item.id===entry.id?{...item,info,error:undefined}:item)});}catch(error){if(signal.aborted)throw error;this.publish({entries:this.snapshot.entries.map(item=>item.id===entry.id?{...item,error:this.error(error)}:item)});}}
   const selected=this.snapshot.entries.find(entry=>entry.id===this.snapshot.selected);if(selected?.info)this.publish({settings:{...this.snapshot.settings,selection:`1-${selected.info.pages.length}`,splitSize:Math.min(10,selected.info.pages.length)}});
  });
 };
 start=async()=>{if(this.busy())return;const selected=this.snapshot.entries.find(entry=>entry.id===this.snapshot.selected),entries=this.snapshot.settings.operation==='merge'?[...this.snapshot.entries]:selected?[selected]:[];
  if(!entries.length||entries.some(entry=>!entry.info||entry.error)){this.publish({error:'pdf_selection'});return;}
  const settings={...this.snapshot.settings};await this.job(entries,'processing',async(signal,progress)=>{const response=await this.deps.run({kind:'write',inputs:entries.map(entry=>entry.input),settings},signal,progress);if(signal.aborted)throw new Error('pdf_cancelled');const size=response.outputs.reduce((sum,output)=>sum+output.blob.size,0);if(!response.outputs.length||size>PDF_TOOLS_LIMITS.resultBytes)throw new Error('pdf_result_limit');
   // Reserve replacement while keeping the old result. A failed reservation preserves it.
   const lease=this.deps.budget.reserve('result',size,'pdf-tools-output');this.resultLease?.release();this.resultLease=lease;this.publish({outputs:response.outputs});
  });
 };
 private async job(entries:readonly PdfEntry[],status:'processing'|'inspecting',execute:(signal:AbortSignal,progress:(value:number)=>void)=>Promise<void>){
  const controller=new AbortController();this.active={controller,ids:entries.map(entry=>entry.id)};this.publish({status:'queued',progress:0,error:undefined});let slot:ReleaseHandle|undefined,lease:MemoryLease|undefined;
  try{
   slot=await new Promise<ReleaseHandle>((resolve,reject)=>{let unsubscribe=()=>{};const abort=()=>{unsubscribe();reject(new Error('pdf_cancelled'));};const acquire=()=>{const acquired=this.deps.execution.tryAcquire('pdf-tools-operation',true);if(acquired){unsubscribe();controller.signal.removeEventListener('abort',abort);resolve(acquired);}};unsubscribe=this.deps.execution.subscribe(acquire);controller.signal.addEventListener('abort',abort,{once:true});acquire();});
   if(controller.signal.aborted)throw new Error('pdf_cancelled');lease=this.deps.budget.reserve('transient',entries.reduce((sum,entry)=>sum+entry.input.size,0)*3+64*1024**2,'pdf-tools-operation');this.publish({status});
   await execute(controller.signal,value=>{if(!controller.signal.aborted)this.publish({progress:value});});if(controller.signal.aborted)throw new Error('pdf_cancelled');this.publish({status:status==='processing'?'completed':'idle',progress:100});
  }catch(error){this.publish({status:controller.signal.aborted?'cancelled':'failed',error:controller.signal.aborted?undefined:this.error(error),progress:0});}
  finally{lease?.release();slot?.release();this.active=undefined;this.cleanup();this.listeners.forEach(listener=>listener());}
 }
 cancel=()=>{this.active?.controller.abort();};
 clear=()=>{if(this.scheduled)clearTimeout(this.scheduled);this.scheduled=undefined;this.cancel();this.resultLease?.release();this.resultLease=undefined;this.publish({entries:[],outputs:[],selected:undefined,error:undefined,status:this.busy()?'cancelled':'idle',settings:defaultSettings});};
 dispose=()=>{this.clear();};
}
