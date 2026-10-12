import {afterEach,expect,it,vi} from 'vitest';
import {runWorker} from '../../src/core/phase5/worker-client';
import {ResourceBudget} from '../../src/core/resources/budget';
import type {P5RunContext} from '../../src/core/phase5/types';
class FakeWorker extends EventTarget {
  static last:FakeWorker; terminated=vi.fn(); posted:unknown[]=[];
  constructor(){super();FakeWorker.last=this;}
  postMessage(value:unknown){this.posted.push(value);}
  terminate(){this.terminated();}
  emit(context:P5RunContext,payload:unknown){this.dispatchEvent(new MessageEvent('message',{data:{taskId:context.taskId,operationId:context.operationId,generation:context.generation,payload}}));}
}
function context(){const controller=new AbortController(),budget=new ResourceBudget();return{controller,budget,c:{taskId:'fictional-task',operationId:'op-1',generation:1,signal:controller.signal,budget,onStage:vi.fn()}};}
const policy={transientBytes:1024,timeoutMs:100,settlement:'terminable'} as const;
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('ignores all three stale identities and releases resources on correct result',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const {c,budget}=context();
  const promise=runWorker(new URL('http://localhost/fictional-worker.js'),{fictional:true},c,policy),w=FakeWorker.last;
  expect(budget.getTransientUsage()).toBe(1024);
  for(const stale of [{...c,generation:0},{...c,taskId:'other'},{...c,operationId:'other'}])w.emit(stale,{type:'result',value:'stale'});
  w.emit(c,{type:'result',value:'valid'});expect(await promise).toBe('valid');expect(w.terminated).toHaveBeenCalledTimes(1);expect(budget.getTransientUsage()).toBe(0);
});
it('worker_timeout_releases_terminable_resources_once',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);const {c,budget}=context();const promise=runWorker(new URL('http://localhost/fictional.js'),{},c,policy);
  const rejection=expect(promise).rejects.toMatchObject({code:'timeout'});await vi.advanceTimersByTimeAsync(101);await rejection;
  expect(FakeWorker.last.terminated).toHaveBeenCalledTimes(1);expect(budget.getTransientUsage()).toBe(0);
});
it('cancel terminates before settlement and does not expose worker error body',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const {c,controller,budget}=context();const promise=runWorker(new URL('http://localhost/fictional.js'),{},c,policy);controller.abort();
  await expect(promise).rejects.toMatchObject({code:'cancel'});expect(budget.getTransientUsage()).toBe(0);expect(FakeWorker.last.terminated).toHaveBeenCalledTimes(1);
});
