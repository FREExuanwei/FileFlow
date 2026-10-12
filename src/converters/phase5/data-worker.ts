import type {P5Input,P5RunContext,P5FileResult} from '../../core/phase5/types';
import {runWorker} from '../../core/phase5/worker-client';
import {P5_LIMITS} from '../../core/phase5/limits';
import type {DataRoute} from './data';
export function runP5Data(input:P5Input,routeId:DataRoute,context:P5RunContext):Promise<P5FileResult>{
  return runWorker(new URL(workerUrl,import.meta.url),{input,routeId},context,{transientBytes:P5_LIMITS.dataTransient,timeoutMs:P5_LIMITS.workerTimeout,settlement:'terminable'});
}
import workerUrl from '../../workers/phase5-data.worker.ts?worker&url';
