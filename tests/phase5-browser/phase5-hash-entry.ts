import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import {Phase5Queue} from '../../src/core/phase5/queue';
import {hashOriginal} from '../../src/converters/phase5/hash';
import {toP5Input} from '../../src/adapters/web/phase5-input';
const budget=new ResourceBudget(),execution=new ExecutionGate();let id:string|undefined;
const status=document.querySelector<HTMLOutputElement>('#status')!,report=document.querySelector<HTMLPreElement>('#report')!;
const queue=new Phase5Queue({budget,execution,run:(input,operation,context)=>hashOriginal(input,operation.kind==='hash'?operation.algorithm:'SHA-256',context)});
// Observe the real Worker commitment boundary; no digest or Worker is mocked.
const NativeWorker=Worker;
window.Worker=class extends NativeWorker{
  postMessage(message:unknown,options?:StructuredSerializeOptions|Transferable[]){
    if(Array.isArray(options))super.postMessage(message,options);else super.postMessage(message,options);
    if((message as {payload?:{type?:string}}).payload?.type==='digest-grant'&&document.querySelector<HTMLInputElement>('#remove-grant')!.checked&&id){
      queue.remove(id);status.dataset.duringTransient=String(budget.getTransientUsage());status.dataset.duringHeavy=String(!execution.canAcquire(true));status.dataset.duringSource=String(budget.getUsage().sourceBytes);
    }
  }
} as typeof Worker;
const usage=()=>{status.dataset.transient=String(budget.getTransientUsage());status.dataset.source=String(budget.getUsage().sourceBytes);status.dataset.heavy=String(!execution.canAcquire(true));};
queue.subscribe(()=>{const job=queue.getSnapshot().items[0];status.textContent=job?.status??'removed';report.textContent=job?.result?.kind==='report'?JSON.stringify(job.result.fields):'';usage();});
budget.subscribe(usage);
document.querySelector('#run')!.addEventListener('click',async()=>{
  queue.clear();report.textContent='';const file=document.querySelector<HTMLInputElement>('#input')!.files?.[0];if(!file)return;
  id=await queue.add(toP5Input(file),{kind:'hash',algorithm:document.querySelector<HTMLSelectElement>('#algorithm')!.value as 'SHA-256'|'SHA-512'});queue.start(id);
  if(document.querySelector<HTMLInputElement>('#cancel-before')!.checked)queue.cancel(id);
});
document.querySelector('#cancel')!.addEventListener('click',()=>{if(id)queue.cancel(id);});document.querySelector('#clear')!.addEventListener('click',()=>queue.clear());
