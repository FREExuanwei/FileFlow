import {openJsonWorkerSession,type JsonWorkerSession} from '../../src/converters/phase5/json-worker';
import {ResourceBudget} from '../../src/core/resources/budget';
import {errorCode} from '../../src/core/phase5/errors';
import type {JsonAction} from '../../src/converters/phase5/json';
const budget=new ResourceBudget();let session:JsonWorkerSession|undefined,controller:AbortController|undefined,generation=0,url:string|undefined;
const status=document.querySelector<HTMLOutputElement>('#status')!,preview=document.querySelector<HTMLPreElement>('#preview')!,download=document.querySelector<HTMLAnchorElement>('#download')!;
const dropDownload=()=>{if(url)URL.revokeObjectURL(url);url=undefined;download.hidden=true;download.removeAttribute('href');preview.textContent='';};
const clear=()=>{generation++;controller?.abort();session?.dispose();session=undefined;dropDownload();status.textContent='cleared';status.dataset.transient=String(budget.getTransientUsage());};
document.querySelector('#clear')!.addEventListener('click',clear);document.querySelector('#input')!.addEventListener('change',clear);document.querySelector('#cancel')!.addEventListener('click',()=>controller?.abort());
for(const action of ['format','minify','validate'] as const)document.querySelector('#'+action)!.addEventListener('click',()=>{void run(action);});
async function run(action:JsonAction){
  const file=document.querySelector<HTMLInputElement>('#input')!.files?.[0];if(!file)return;controller?.abort();controller=new AbortController();const current=++generation;dropDownload();status.textContent='processing';
  const context={taskId:'fictional-json',operationId:`action-${current}`,generation:current,signal:controller.signal,budget,onStage:()=>{}};
  try{
    if(!session)session=await openJsonWorkerSession({name:file.name,size:file.size,type:file.type,blob:file},context);
    const result=await session.run(action,context);if(current!==generation)return;
    if(result.kind==='file'){url=URL.createObjectURL(result.blob);download.href=url;download.download=result.name;download.hidden=false;preview.textContent=result.preview;status.textContent='completed';}
    else{preview.textContent=JSON.stringify(result.fields);status.textContent=result.fields.valid?'valid':'invalid';}
  }catch(error){if(current===generation){status.textContent=errorCode(error);session?.dispose();session=undefined;}}finally{status.dataset.transient=String(budget.getTransientUsage());}
}
