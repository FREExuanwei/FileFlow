import {ResourceBudget} from '../../src/core/resources/budget';
import {toP5Input} from '../../src/adapters/web/phase5-input';
import {inspectBasic} from '../../src/converters/phase5/inspect';
import {errorCode} from '../../src/core/phase5/errors';
const budget=new ResourceBudget();let controller:AbortController|undefined,generation=0;
const status=document.querySelector<HTMLOutputElement>('#status')!,report=document.querySelector<HTMLPreElement>('#report')!;
document.querySelector('#cancel')!.addEventListener('click',()=>controller?.abort());
document.querySelector('#run')!.addEventListener('click',async()=>{
  controller?.abort();const current=++generation,signal=(controller=new AbortController()).signal;
  const file=document.querySelector<HTMLInputElement>('#input')!.files?.[0];if(!file)return;report.textContent='';status.textContent='processing';
  try{const result=await inspectBasic(toP5Input(file),document.querySelector<HTMLInputElement>('#structural')!.checked,{taskId:'fictional',operationId:`inspect-${current}`,generation:current,signal,budget,onStage:()=>{}});if(current===generation){report.textContent=JSON.stringify(result.fields);status.textContent='completed';}}
  catch(error){if(current===generation)status.textContent=errorCode(error);}finally{status.dataset.transient=String(budget.getTransientUsage());}
});
