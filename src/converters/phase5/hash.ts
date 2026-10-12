import type {P5Input,P5RunContext,P5ReportResult} from '../../core/phase5/types';
import {runWorker} from '../../core/phase5/worker-client';
import {assertLimit} from '../../core/phase5/limits';
import {P5Error} from '../../core/phase5/errors';
export async function hashOriginal(input:P5Input,algorithm:'SHA-256'|'SHA-512',context:P5RunContext):Promise<P5ReportResult>{
  assertLimit('hashSource',input.size);if(input.size!==input.blob.size)throw new P5Error('input');if(algorithm!=='SHA-256'&&algorithm!=='SHA-512')throw new P5Error('type');
  return runWorker(new URL(workerUrl,import.meta.url),{input,algorithm},context,{transientBytes:3*input.size+2*1024**2,timeoutMs:60000,settlement:'native-digest'});
}
import workerUrl from '../../workers/phase5-hash.worker.ts?worker&url';
