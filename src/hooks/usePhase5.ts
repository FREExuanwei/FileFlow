import {useEffect,useState,useSyncExternalStore} from 'react';
import type {ConversionQueue} from '../core/queue/store';
import type {ResourceBudget} from '../core/resources/budget';
import type {ExecutionGate} from '../core/resources/execution';
import {Phase5Queue} from '../core/phase5/queue';
import {WorkspaceCoordinator} from '../core/phase5/workspace';
import {PRODUCT_ADMISSION} from '../core/phase5/catalog';
import {createP5Services} from '../converters/phase5/run';
import {P5Error} from '../core/phase5/errors';
import type {P5Input} from '../core/phase5/types';
import {assertOperationInputLimit} from '../core/phase5/input-policy';
export function usePhase5(legacy:ConversionQueue,resources:{budget:ResourceBudget;execution:ExecutionGate}){
  const [state]=useState(()=>{const services=createP5Services(PRODUCT_ADMISSION,()=>matchMedia('(max-width: 700px)').matches),queue=new Phase5Queue({...resources,run:services.run,onSourceRelease:services.releaseInput,active:false}),coordinator=new WorkspaceCoordinator(legacy,queue,PRODUCT_ADMISSION,false);return{services,queue,coordinator};});
  const snapshot=useSyncExternalStore(state.coordinator.subscribe,state.coordinator.getSnapshot);
  useEffect(()=>{state.queue.activate();state.coordinator.activate();return()=>{state.coordinator.dispose();state.queue.dispose();state.services.dispose();};},[state]);
  const inspectWorkbook=async(input:P5Input,signal:AbortSignal)=>{assertOperationInputLimit(input.size,{kind:'route',routeId:'xlsx-to-csv'},matchMedia('(max-width: 700px)').matches);const taskId=`xlsx-inspection-${Date.now()}`,permit=resources.execution.tryAcquire(taskId,true);if(!permit)throw new P5Error('budget');try{const {inspectWorkbook}=await import('../converters/phase5/xlsx/worker-client');return await inspectWorkbook(input.blob,{taskId,operationId:taskId,generation:0,signal,budget:resources.budget,onStage:()=>{}});}finally{permit.release();}};
  return{...state,snapshot,inspectWorkbook};
}
