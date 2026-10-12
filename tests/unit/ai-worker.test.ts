import { expect, it, vi, afterEach } from 'vitest';
import { analyzeAiDocument } from '../../src/converters/ai-ready/worker';
import { settingsForPreset } from '../../src/core/ai-ready/defaults';
const document={sourceFormat:'md' as const,pages:[{number:1,markdown:'# Fictional\n\ntext',lines:[],blank:false}],warnings:[]};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('abort_terminates_and_discards_late_reply',async()=> {
  const instances:FakeWorker[]=[];
  class FakeWorker {onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminate=vi.fn();postMessage=vi.fn();constructor(){instances.push(this);}}
  vi.stubGlobal('Worker',FakeWorker);const controller=new AbortController();
  const task=analyzeAiDocument(document,settingsForPreset('balanced'),{signal:controller.signal,generation:2});
  controller.abort();await expect(task).rejects.toThrow('cancelled');expect(instances[0]!.terminate).toHaveBeenCalledTimes(1);
});
it('worker_stages_follow_actual_operations_and_wrong_generation_is_ignored',async()=> {
  const instances:FakeWorker[]=[];
  class FakeWorker {onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminate=vi.fn();postMessage=vi.fn();constructor(){instances.push(this);}}
  vi.stubGlobal('Worker',FakeWorker);const stages:string[]=[];
  const task=analyzeAiDocument(document,settingsForPreset('balanced'),{signal:new AbortController().signal,generation:4,onStage:s=>stages.push(s)});
  instances[0]!.onmessage!({data:{generation:3,type:'stage',stage:'estimating'}});
  for(const stage of ['cleaning','structure','estimating','chunking'])instances[0]!.onmessage!({data:{generation:4,type:'stage',stage}});
  instances[0]!.onmessage!({data:{generation:4,type:'error',code:'no-content'}});
  await expect(task).rejects.toThrow('no-content');expect(stages).toEqual(['cleaning','structure','estimating','chunking']);
});
it('oversized_document_is_rejected_before_worker_creation',async()=>{
  const worker=vi.fn();vi.stubGlobal('Worker',worker);const oversized={...document,pages:[{...document.pages[0]!,markdown:'a'.repeat(16*1024**2+1)}]};await expect(analyzeAiDocument(oversized,settingsForPreset('balanced'),{signal:new AbortController().signal,generation:1})).rejects.toThrow('text-limit');expect(worker).not.toHaveBeenCalled();
});
it('already_aborted_and_invalid_settings_never_create_a_worker',async()=>{
  const factory=vi.fn();vi.stubGlobal('Worker',factory);const controller=new AbortController();controller.abort();await expect(analyzeAiDocument(document,settingsForPreset('balanced'),{signal:controller.signal,generation:1})).rejects.toThrow('cancelled');await expect(analyzeAiDocument(document,{...settingsForPreset('balanced'),preset:'invalid'} as never,{signal:new AbortController().signal,generation:1})).rejects.toThrow('invalid-settings');expect(factory).not.toHaveBeenCalled();
});
it('worker_error_post_failure_and_timeout_release_timers_and_terminate',async()=>{
  vi.useFakeTimers();const instances:FakeWorker[]=[];let throwPost=false;class FakeWorker{onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminate=vi.fn();postMessage(){if(throwPost)throw new Error('fictional clone error');}constructor(){instances.push(this);}}vi.stubGlobal('Worker',FakeWorker);
  const options={signal:new AbortController().signal,generation:1};const errored=analyzeAiDocument(document,settingsForPreset('balanced'),options),errorCheck=expect(errored).rejects.toThrow('worker-failed');instances[0]!.onerror!();await errorCheck;expect(instances[0]!.terminate).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  throwPost=true;await expect(analyzeAiDocument(document,settingsForPreset('balanced'),options)).rejects.toThrow('worker-failed');expect(instances[1]!.terminate).toHaveBeenCalledTimes(1);throwPost=false;
  const timed=analyzeAiDocument(document,settingsForPreset('balanced'),options),timeoutCheck=expect(timed).rejects.toThrow('timeout');await vi.advanceTimersByTimeAsync(60000);await timeoutCheck;expect(instances[2]!.terminate).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
