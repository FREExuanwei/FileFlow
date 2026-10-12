import {it,expect} from 'vitest';
import {OcrQueue} from '../../src/core/ocr/queue';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
const file=(name='fiction.png')=>({name,size:4,type:'image/png',blob:new Blob([new Uint8Array(4)])});
const result=()=>({pages:[{number:1,status:'completed' as const,text:'fiction',origin:'ocr' as const}],partial:false});
const tick=()=>new Promise<void>(r=>setTimeout(r,0));
it('OCR batch shares one heavy execution slot and releases sources only after successful result commit',async()=>{
 const budget=new ResourceBudget(),execution=new ExecutionGate();let release!:()=>void;const wait=new Promise<void>(r=>release=r);let calls=0;
 const queue=new OcrQueue({budget,execution,process:async()=>{calls++;await wait;return result();}});queue.add([file(),file('second.png')]);queue.startAll();await tick();expect(calls).toBe(1);expect(execution.canAcquire(true)).toBe(false);expect(budget.getUsage().sourceBytes).toBe(8);release();await tick();await tick();expect(calls).toBe(2);expect(queue.getSnapshot().items.every(j=>j.status==='completed')).toBe(true);expect(budget.getUsage().sourceBytes).toBe(0);queue.clear();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});expect(budget.getTransientUsage()).toBe(0);queue.dispose();
});
it('cancel retains the heavy slot until real processing settles and ignores its stale result',async()=>{
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);const budget=new ResourceBudget(),execution=new ExecutionGate();const q=new OcrQueue({budget,execution,process:async()=>{await wait;return result();}});q.add([file()]);const id=q.getSnapshot().items[0]!.id;q.start(id);q.cancel(id);expect(q.getSnapshot().items[0]?.status).toBe('cancelled');expect(execution.canAcquire(true)).toBe(false);release();await tick();expect(q.getSnapshot().items[0]?.result).toBeUndefined();expect(execution.canAcquire(true)).toBe(true);q.clear();q.dispose();
});
it('failed OCR keeps its source for retry and does not discard earlier successful output',async()=>{
 let attempts=0;const q=new OcrQueue({budget:new ResourceBudget(),execution:new ExecutionGate(),process:async()=>{if(++attempts===2)throw Error('ocr_failed');return result();}});q.add([file(),file('other.png')]);q.startAll();await tick();await tick();const [good,bad]=q.getSnapshot().items;expect(good?.result).toBeDefined();expect(bad?.input).toBeDefined();expect(bad?.status).toBe('failed');q.start(bad!.id);await tick();expect(q.getSnapshot().items[1]?.status).toBe('completed');q.dispose();
});
