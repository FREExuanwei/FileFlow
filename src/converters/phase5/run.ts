import type {P5Input,P5Operation,P5RunContext,P5Runner,P5FileResult} from '../../core/phase5/types';
import {assertAdmittedRoute,PRODUCT_ADMISSION,type Admission} from '../../core/phase5/catalog';
import {P5Error} from '../../core/phase5/errors';
import type {JsonWorkerSession} from './json-worker';
import {assertOperationInputLimit} from '../../core/phase5/input-policy';
import {detectP5Format} from '../../core/phase5/detect';
export async function runPhase5Route(input:P5Input,operation:Extract<P5Operation,{kind:'route'}>,context:P5RunContext,admission:Admission):Promise<P5FileResult>{
  assertAdmittedRoute(operation.routeId,admission);
  await detectP5Format(input);
  if(operation.routeId.startsWith('xlsx-')){const {convertXlsx}=await import('./xlsx/convert');return convertXlsx(input,operation,context);}
  if(operation.routeId.includes('yaml')){const {runP5Yaml}=await import('./yaml-worker');return runP5Yaml(input,operation.routeId as 'yaml-to-json'|'json-to-yaml',context);}
  const {runP5Data}=await import('./data-worker');return runP5Data(input,operation.routeId as 'csv-to-tsv'|'tsv-to-csv'|'tsv-to-json'|'json-to-tsv',context);
}
export function createP5Services(admission:Admission=PRODUCT_ADMISSION,narrow:()=>boolean=()=>false):{run:P5Runner;releaseInput(input:P5Input):void;dispose():void}{
  const sessions=new Map<P5Input,Map<string,Promise<JsonWorkerSession>>>();
  const releaseInput=(input:P5Input)=>{const group=sessions.get(input);sessions.delete(input);for(const pending of group?.values()??[])void pending.then(session=>session.dispose(),()=>{});};
  const run:P5Runner=async(input,operation,context)=>{
    assertOperationInputLimit(input.size,operation,narrow());
    if(operation.kind==='route')return runPhase5Route(input,operation,context,admission);
    if(operation.kind==='hash'){const {hashOriginal}=await import('./hash');return hashOriginal(input,operation.algorithm,context);}
    if(operation.kind==='inspect'){const {inspectBasic}=await import('./inspect');return inspectBasic(input,operation.structural,context);}
    if(!/\.json$/i.test(input.name))throw new P5Error('type');
    const {openJsonWorkerSession}=await import('./json-worker');let group=sessions.get(input);if(!group){group=new Map();sessions.set(input,group);}let pending=group.get(context.taskId);if(!pending){pending=openJsonWorkerSession(input,context);group.set(context.taskId,pending);}
    try{return await(await pending).run(operation.action,context);}catch(error){group.delete(context.taskId);void pending.then(session=>session.dispose(),()=>{});throw error;}
  };
  return{run,releaseInput,dispose:()=>{for(const input of sessions.keys())releaseInput(input);}};
}
