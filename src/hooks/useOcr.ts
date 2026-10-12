import {useEffect,useState,useSyncExternalStore} from 'react';
import {OcrQueue} from '../core/ocr/queue';
import type {ResourceBudget} from '../core/resources/budget';
import type {ExecutionGate} from '../core/resources/execution';
import {getDesktopPlatform} from '../adapters/platform';
export function useOcr(resources:{budget:ResourceBudget;execution:ExecutionGate}){
 const [queue]=useState(()=>new OcrQueue({...resources,async process(input,language,signal,onProgress){if(!getDesktopPlatform())throw Error('ocr_unavailable');const {processDesktopOcr}=await import('../adapters/desktop/ocr');return processDesktopOcr(input,language,signal,onProgress,resources.budget);}}));
 const snapshot=useSyncExternalStore(queue.subscribe,queue.getSnapshot);useEffect(()=>{queue.activate();return()=>queue.dispose();},[queue]);return{queue,snapshot};
}
