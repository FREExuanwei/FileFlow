import {ResourceBudget} from '../../src/core/resources/budget';
import {inspectWorkbook} from '../../src/converters/phase5/xlsx/worker-client';
import {errorCode} from '../../src/core/phase5/errors';
import {runWorker} from '../../src/core/phase5/worker-client';
import {P5_LIMITS} from '../../src/core/phase5/limits';
import {convertXlsx} from '../../src/converters/phase5/xlsx/convert';
const budget=new ResourceBudget(),status=document.querySelector<HTMLOutputElement>('#status')!,preview=document.querySelector<HTMLPreElement>('#preview')!,download=document.querySelector<HTMLAnchorElement>('#download')!;let controller:AbortController|undefined,generation=0,url:string|undefined;
document.querySelector('#cancel')!.addEventListener('click',()=>controller?.abort());
function release(){if(url)URL.revokeObjectURL(url);url=undefined;download.hidden=true;download.removeAttribute('href');document.querySelector('#notices')!.textContent='';}
document.querySelector('#clear')!.addEventListener('click',()=>{controller?.abort();generation++;release();status.textContent='cleared';preview.textContent='';});
document.querySelector('#run')!.addEventListener('click',async()=>{
  controller?.abort();release();controller=new AbortController();const current=++generation,file=document.querySelector<HTMLInputElement>('#input')!.files?.[0];if(!file)return;preview.textContent='';status.textContent='processing';
  try{const context={taskId:'fictional',operationId:`op-${current}`,generation:current,signal:controller.signal,budget,onStage:()=>{}};const action=document.querySelector<HTMLSelectElement>('#action')!.value;
    if(action!=='inspect'){const result=await convertXlsx({name:file.name,size:file.size,type:file.type,blob:file},{kind:'route',routeId:action,sheetId:document.querySelector<HTMLInputElement>('#sheet')!.value||undefined,headers:document.querySelector<HTMLSelectElement>('#headers')!.value as 'first-row'|'generated'},context);if(current===generation){url=URL.createObjectURL(result.blob);download.href=url;download.download=result.name;download.hidden=false;preview.textContent=result.preview;document.querySelector('#notices')!.textContent=JSON.stringify(result.notices);status.textContent='completed';}}
    else{const result=document.querySelector<HTMLInputElement>('#normalize')!.checked?await runWorker(new URL('./phase5-xlsx-probe.worker.ts',import.meta.url),{blob:file},context,{transientBytes:P5_LIMITS.xlsxTransient,timeoutMs:P5_LIMITS.workerTimeout,settlement:'terminable'}):await inspectWorkbook(file,context);if(current===generation){preview.textContent=JSON.stringify(result);status.textContent='completed';}}}
  catch(error){if(current===generation)status.textContent=errorCode(error);}finally{status.dataset.transient=String(budget.getTransientUsage());}
});
