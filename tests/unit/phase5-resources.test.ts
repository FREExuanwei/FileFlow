import {afterEach,expect,it,vi} from 'vitest';
import {ResourceBudget} from '../../src/core/resources/budget';
import {runWorker} from '../../src/core/phase5/worker-client';
afterEach(()=>vi.unstubAllGlobals());
it('rejects transient allocation before creating Worker or reading input',async()=>{
  const budget=new ResourceBudget(),lease=budget.reserve('transient',256*1024**2,'fictional-ai'),worker=vi.fn();vi.stubGlobal('Worker',worker);
  await expect(runWorker(new URL('http://localhost/fictional.js'),{}, {taskId:'a',operationId:'b',generation:0,budget,signal:new AbortController().signal,onStage:()=>{}}, {transientBytes:1,timeoutMs:100,settlement:'terminable'})).rejects.toMatchObject({code:'budget'});
  expect(worker).not.toHaveBeenCalled();lease.release();expect(budget.getTransientUsage()).toBe(0);
});
