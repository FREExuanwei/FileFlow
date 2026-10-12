import { expect, it } from 'vitest';
import { ResourceBudget } from '../../src/core/resources/budget';
import { ExecutionGate } from '../../src/core/resources/execution';
import { ConversionQueue } from '../../src/core/queue/store';
it('lease_release_and_failed_resize_are_safe',()=> {
  const b=new ResourceBudget(),l=b.reserve('result',120*1024**2,'a');
  expect(()=>l.resize(129*1024**2)).toThrow();expect(b.getUsage().resultBytes).toBe(120*1024**2);
  l.release();l.release();expect(b.getUsage().resultBytes).toBe(0);
  const gate=new ExecutionGate(),a=gate.tryAcquire('a',true)!;
  expect(gate.tryAcquire('b',true)).toBeUndefined();const c=gate.tryAcquire('c',false)!;
  expect(gate.tryAcquire('d',false)).toBeUndefined();a.release();c.release();expect(gate.tryAcquire('b',true)).toBeDefined();
});
it('two_queues_share_reservations_before_async_validation',async()=> {
  const budget=new ResourceBudget(),execution=new ExecutionGate(),a=new ConversionQueue({budget,execution}),b=new ConversionQueue({budget,execution});
  const file={name:'fictional.csv',type:'text/csv',size:8*1024**2,blob:new Blob(['name\nFictional\n'])};
  const pending=a.add(Array.from({length:20},()=>({...file})));const other=b.add(Array.from({length:20},()=>({...file})));
  expect(budget.getUsage().sourceBytes).toBeLessThanOrEqual(200*1024**2);
  await Promise.all([pending,other]);expect(a.getSnapshot().items.length+b.getSnapshot().items.length).toBe(25);
  a.clear();b.clear();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});
});
it('external_heavy_operation_does_not_block_independent_light_conversion',async()=>{
  const execution=new ExecutionGate(),lease=execution.tryAcquire('ai',true)!;const q=new ConversionQueue({execution,run:async()=>({name:'fictional.json',format:'json',blob:new Blob(['[]']),warnings:[]})});
  const pdf=new Blob([new Uint8Array(await import('node:fs').then(fs=>fs.readFileSync('tests/fixtures/demo.pdf')))]),csv=new Blob(['a\n1']);await q.add([{name:'fictional.pdf',type:'application/pdf',size:pdf.size,blob:pdf},{name:'fictional.csv',type:'text/csv',size:csv.size,blob:csv}]);q.startAll();await new Promise(r=>setTimeout(r,5));expect(q.getSnapshot().items[1]!.status).toBe('completed');expect(q.getSnapshot().items[0]!.status).toBe('queued');lease.release();await new Promise(r=>setTimeout(r,5));q.dispose();
});
it('removing_task_before_queued_restore_releases_reserved_source',async()=>{
  const budget=new ResourceBudget(),q=new ConversionQueue({budget,run:async()=>({name:'fictional.json',format:'json',blob:new Blob(['[]']),warnings:[]})});const file={name:'fictional.csv',type:'text/csv',size:4,blob:new Blob(['a\n1\n'])};await q.add([file]);const id=q.getSnapshot().items[0]!.id;const restoring=q.restore(id,{...file,blob:new Blob(['a\n2\n'])});q.remove(id);await restoring;expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});q.dispose();
});
