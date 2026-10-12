import {it,expect} from 'vitest';
import {OcrQueue} from '../../src/core/ocr/queue';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import type {ProcessedOcr} from '../../src/core/ocr/pipeline';
it('reports pending native cancellation and only enables retry after actual settlement',async()=>{let resolve!:(result:ProcessedOcr)=>void,calls=0;const budget=new ResourceBudget(),queue=new OcrQueue({budget,execution:new ExecutionGate(),process:()=>{calls++;return new Promise(r=>{resolve=r;});}});queue.add([{name:'invented.png',type:'image/png',size:4,blob:new Blob(['fake'])}]);const id=queue.getSnapshot().items[0]!.id;queue.start(id);queue.cancel(id);expect(queue.getSnapshot().items[0]?.settling).toBe(true);queue.start(id);expect(calls).toBe(1);resolve({partial:false,pages:[{number:1,text:'fictional',origin:'ocr',status:'completed'}]});await new Promise(r=>setTimeout(r,0));expect(queue.getSnapshot().items[0]?.settling).toBe(false);expect(queue.getSnapshot().items[0]?.result).toBeUndefined();queue.clear();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});});
