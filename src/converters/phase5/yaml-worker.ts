import type {P5Input,P5RunContext,P5FileResult} from '../../core/phase5/types';
import {runWorker} from '../../core/phase5/worker-client';
import {P5_LIMITS} from '../../core/phase5/limits';
export function runP5Yaml(input:P5Input,routeId:'yaml-to-json'|'json-to-yaml',context:P5RunContext):Promise<P5FileResult>{
  return runWorker(new URL(workerUrl,import.meta.url),{input,routeId},context,{transientBytes:P5_LIMITS.structuredTransient,timeoutMs:P5_LIMITS.workerTimeout,settlement:'terminable'});
}
import workerUrl from '../../workers/phase5-yaml.worker.ts?worker&url';
