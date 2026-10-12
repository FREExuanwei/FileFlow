import {ResourceBudget} from '../../src/core/resources/budget';
import {runP5Yaml} from '../../src/converters/phase5/yaml-worker';
import {errorCode} from '../../src/core/phase5/errors';
const budget=new ResourceBudget();let controller:AbortController|undefined,url:string|undefined,generation=0;
const status=document.querySelector<HTMLOutputElement>('#status')!,download=document.querySelector<HTMLAnchorElement>('#download')!,preview=document.querySelector<HTMLPreElement>('#preview')!;
const clear=()=>{controller?.abort();generation++;if(url)URL.revokeObjectURL(url);url=undefined;download.hidden=true;download.removeAttribute('href');preview.textContent='';status.textContent='cleared';};
document.querySelector('#clear')!.addEventListener('click',clear);document.querySelector('#cancel')!.addEventListener('click',()=>controller?.abort());
document.querySelector('#run')!.addEventListener('click',async()=>{
  clear();const file=document.querySelector<HTMLInputElement>('#input')!.files?.[0];if(!file)return;
  controller=new AbortController();const current=generation;status.textContent='processing';
  try{
    const result=await runP5Yaml({name:file.name,type:file.type,size:file.size,blob:file},document.querySelector<HTMLSelectElement>('#route')!.value as 'yaml-to-json'|'json-to-yaml',{taskId:'fictional',operationId:`run-${current}`,generation:current,budget,signal:controller.signal,onStage:()=>{}});
    if(current!==generation)return;url=URL.createObjectURL(result.blob);download.href=url;download.download=result.name;download.hidden=false;preview.textContent=result.preview;status.textContent='completed';
  }catch(error){if(current===generation)status.textContent=errorCode(error);}finally{status.dataset.transient=String(budget.getTransientUsage());}
});
