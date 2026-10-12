import type {P5Input,P5Operation,P5RunContext,P5FileResult} from '../../../core/phase5/types';
import {runWorker} from '../../../core/phase5/worker-client';
import {P5_LIMITS,assertLimit} from '../../../core/phase5/limits';
import {P5Error} from '../../../core/phase5/errors';
export function convertXlsx(input:P5Input,operation:Extract<P5Operation,{kind:'route'}>,context:P5RunContext):Promise<P5FileResult>{
  if(!['xlsx-to-csv','xlsx-to-json'].includes(operation.routeId)||input.size!==input.blob.size||!/\.xlsx$/i.test(input.name))throw new P5Error('input');assertLimit('xlsxSource',input.size);
  return runWorker(new URL(workerUrl,import.meta.url),{action:'convert',input,operation},context,{transientBytes:P5_LIMITS.xlsxTransient,timeoutMs:P5_LIMITS.workerTimeout,settlement:'terminable'});
}
import workerUrl from '../../../workers/phase5-xlsx.worker.ts?worker&url';
