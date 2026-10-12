import {useEffect,useState,useSyncExternalStore} from 'react';
import {PdfToolsStore} from '../core/pdf-tools/store';
import {runPdfWorker} from '../converters/pdf-tools/client';
import type {ResourceBudget} from '../core/resources/budget';
import type {ExecutionGate} from '../core/resources/execution';
export function usePdfTools(resources:{budget:ResourceBudget;execution:ExecutionGate}){
 const [store]=useState(()=>new PdfToolsStore({...resources,run:runPdfWorker}));const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot);useEffect(()=>()=>store.dispose(),[store]);return{store,snapshot};
}
