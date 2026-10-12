import { useEffect,useState,useSyncExternalStore } from 'react';
import { AiReadyQueue } from '../core/ai-ready/queue';
import type { ResourceBudget } from '../core/resources/budget';
import type { ExecutionGate } from '../core/resources/execution';
export function useAiReady(resources:{budget:ResourceBudget;execution:ExecutionGate}){
  const [queue]=useState(()=>new AiReadyQueue(resources));const snapshot=useSyncExternalStore(queue.subscribe,queue.getSnapshot);
  useEffect(()=>{queue.activate();return()=>queue.dispose();},[queue]);return {queue,snapshot};
}
