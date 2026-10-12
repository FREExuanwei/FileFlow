import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import {Phase5Queue} from '../../src/core/phase5/queue';
import type {P5RunContext,P5Input} from '../../src/core/phase5/types';
class ControlledWorker extends EventTarget{
  static last:ControlledWorker;posted:Record<string,unknown>[]=[];terminate=vi.fn();constructor(){super();ControlledWorker.last=this;}
  postMessage(value:Record<string,unknown>){this.posted.push(value);}
  emit(payload:unknown,identity?:Partial<P5RunContext>){const message=this.posted[0]!;this.dispatchEvent(new MessageEvent('message',{data:{...message,...identity,payload}}));}
}
const input=(size=3):P5Input=>({name:'fictional.bin',type:'application/octet-stream',size,blob:new Blob([new Uint8Array(size)])});
const setup=()=>{const controller=new AbortController(),budget=new ResourceBudget();return{controller,budget,c:{taskId:'fictional',operationId:'hash-1',generation:1,signal:controller.signal,budget,onStage:vi.fn()}};};
beforeEach(()=>{vi.resetModules();vi.stubGlobal('Worker',ControlledWorker);});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('rejects32MiB plus one before Worker or input read',async()=>{
  const {hashOriginal}=await import('../../src/converters/phase5/hash');const i=input(32*1024**2+1),read=vi.spyOn(i.blob,'arrayBuffer');const {c,budget}=setup();
  await expect(hashOriginal(i,'SHA-256',c)).rejects.toMatchObject({code:'size'});expect(read).not.toHaveBeenCalled();expect(budget.getTransientUsage()).toBe(0);
});
it('cancel before digest grant terminates reader and releases once',async()=>{
  const {hashOriginal}=await import('../../src/converters/phase5/hash');const {c,controller,budget}=setup(),pending=hashOriginal(input(),'SHA-256',c),w=ControlledWorker.last;
  controller.abort();await expect(pending).rejects.toMatchObject({code:'cancel'});expect(w.terminate).toHaveBeenCalledTimes(1);expect(budget.getTransientUsage()).toBe(0);w.emit({type:'digest-ready'});expect(w.posted).toHaveLength(1);
});
it('grant is the commitment boundary even before a digest-start message',async()=>{
  const {hashOriginal}=await import('../../src/converters/phase5/hash');const {c,controller,budget}=setup(),pending=hashOriginal(input(),'SHA-256',c),w=ControlledWorker.last;
  const rejection=expect(pending).rejects.toMatchObject({code:'cancel'});w.emit({type:'digest-ready'});expect(w.posted[1]?.payload).toEqual({type:'digest-grant'});controller.abort();
  expect(w.terminate).not.toHaveBeenCalled();expect(budget.getTransientUsage()).toBe(2*1024**2+9);
  w.emit({type:'digest-settled',hash:'a'.repeat(64)});await rejection;expect(w.terminate).toHaveBeenCalledTimes(1);expect(budget.getTransientUsage()).toBe(0);
});
it('remove during native digest retains shared source/task/heavy slot until settlement',async()=>{
  const {hashOriginal}=await import('../../src/converters/phase5/hash');const budget=new ResourceBudget(),execution=new ExecutionGate();
  const queue=new Phase5Queue({budget,execution,run:(i,o,c)=>hashOriginal(i,o.kind==='hash'?o.algorithm:'SHA-256',c)}),id=await queue.add(input(),{kind:'hash',algorithm:'SHA-256'});queue.start(id);await Promise.resolve();const w=ControlledWorker.last;w.emit({type:'digest-ready'});queue.remove(id);
  expect(budget.getUsage()).toMatchObject({tasks:1,sourceBytes:3});expect(execution.canAcquire(true)).toBe(false);expect(w.terminate).not.toHaveBeenCalled();w.emit({type:'digest-settled',hash:'a'.repeat(64)});
  await vi.waitFor(()=>expect(execution.canAcquire(true)).toBe(true));expect(queue.getSnapshot().items).toEqual([]);expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});queue.dispose();
});
it('watchdog unknown settlement blocks new hash until refresh and retains accounting',async()=>{
  vi.useFakeTimers();const {hashOriginal}=await import('../../src/converters/phase5/hash');const {c,budget}=setup(),pending=hashOriginal(input(),'SHA-256',c),w=ControlledWorker.last;void pending.catch(()=>{});w.emit({type:'digest-ready'});await vi.advanceTimersByTimeAsync(60001);
  expect(c.onStage).toHaveBeenCalledWith('hash-refresh-required');expect(w.terminate).not.toHaveBeenCalled();expect(budget.getTransientUsage()).toBeGreaterThan(0);
  await expect(hashOriginal(input(),'SHA-256',{...c,taskId:'new'})).rejects.toMatchObject({code:'security'});
  w.emit({type:'digest-settled',hash:'a'.repeat(64)});await pending;expect(budget.getTransientUsage()).toBe(0);
});
it('stale ready/settled cannot grant or release current native accounting',async()=>{
  const {hashOriginal}=await import('../../src/converters/phase5/hash');const {c,budget}=setup(),pending=hashOriginal(input(),'SHA-512',c),w=ControlledWorker.last;
  w.emit({type:'digest-ready'},{generation:0});expect(w.posted).toHaveLength(1);w.emit({type:'digest-ready'});w.emit({type:'digest-settled',hash:'a'.repeat(128)},{operationId:'old'});expect(budget.getTransientUsage()).toBeGreaterThan(0);w.emit({type:'digest-settled',hash:'a'.repeat(128)});expect((await pending).fields.hash).toBe('a'.repeat(128));
});
