import type {P5RunContext} from '../../../core/phase5/types';
import {P5_LIMITS,assertLimit} from '../../../core/phase5/limits';
import {runWorker} from '../../../core/phase5/worker-client';
import type {WorkbookInfo} from './parser';
export function inspectWorkbook(blob:Blob,context:P5RunContext):Promise<WorkbookInfo>{
  assertLimit('xlsxSource',blob.size);
  return runWorker(new URL(workerUrl,import.meta.url),{action:'inspect',blob},context,{transientBytes:P5_LIMITS.xlsxTransient,timeoutMs:P5_LIMITS.workerTimeout,settlement:'terminable'});
}
import workerUrl from '../../../workers/phase5-xlsx.worker.ts?worker&url';
