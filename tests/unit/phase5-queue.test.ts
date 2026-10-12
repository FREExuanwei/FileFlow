import {expect,it,vi} from 'vitest';
import {Phase5Queue} from '../../src/core/phase5/queue';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import type {P5Input,P5Result,P5Runner} from '../../src/core/phase5/types';
const input=():P5Input=>({name:'fictional.json',type:'application/json',size:2,blob:new Blob(['{}'])});
const result=():P5Result=>({kind:'file',name:'fictional.tsv',format:'tsv',blob:new Blob(['ok']),preview:'ok',notices:[]});
const report=():P5Result=>({kind:'report',reportType:'validation',fields:{valid:true},notices:[]});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const deferred=()=>{let resolve!:(r:P5Result)=>void; const promise=new Promise<P5Result>(r=>{resolve=r;}); return{promise,resolve};};
function setup(run:P5Runner=async()=>result()) {const budget=new ResourceBudget(),execution=new ExecutionGate(),released=vi.fn();return{budget,execution,released,q:new Phase5Queue({budget,execution,run,onSourceRelease:released})};}
it('reserves source and task before publishing and route success releases source once',async()=>{
  const {q,budget,released}=setup(),id=await q.add(input(),{kind:'route',routeId:'json-to-tsv'});
  expect(budget.getUsage()).toMatchObject({tasks:1,sourceBytes:2});q.start(id);await tick();
  expect(q.getSnapshot().items[0]?.status).toBe('completed');expect(budget.getUsage()).toMatchObject({sourceBytes:0,resultBytes:2});expect(released).toHaveBeenCalledTimes(1);
  q.clear();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});expect(released).toHaveBeenCalledTimes(1);q.dispose();
});
it('utilities keep source until removal',async()=>{
  const {q,budget,released}=setup(async()=>report()),id=await q.add(input(),{kind:'json',action:'validate'});q.start(id);await tick();
  expect(q.getSnapshot().items[0]?.result).toEqual(report());expect(budget.getUsage().sourceBytes).toBe(2);expect(released).not.toHaveBeenCalled();
  q.remove(id);expect(released).toHaveBeenCalledTimes(1);expect(budget.getUsage().tasks).toBe(0);q.dispose();
});
it('late_generation_cannot_commit and cancellation_holds_slot_until_settlement',async()=>{
  const d=deferred(),{q,budget,execution}=setup(()=>d.promise),id=await q.add(input(),{kind:'hash',algorithm:'SHA-256'});
  q.start(id);expect(execution.canAcquire(true)).toBe(false);q.cancel(id);q.remove(id);
  expect(execution.canAcquire(true)).toBe(false);expect(budget.getUsage().sourceBytes).toBe(2);d.resolve(result());await tick();
  expect(q.getSnapshot().items).toEqual([]);expect(execution.canAcquire(true)).toBe(true);expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});q.dispose();
});
it('reserve_result_before_publish when existing owner consumes result cap',async()=>{
  const {q,budget}=setup(),lease=budget.reserve('result',128*1024**2,'fictional-legacy'),id=await q.add(input(),{kind:'route',routeId:'json-to-tsv'});
  q.start(id);await tick();expect(q.getSnapshot().items[0]).toMatchObject({status:'failed',errorCode:'budget'});expect(q.getSnapshot().items[0]?.result).toBeUndefined();lease.release();q.dispose();expect(budget.getUsage().tasks).toBe(0);
});
it('one_failure_keeps_other_result and completed snapshots remain immutable',async()=>{
  let n=0;const {q}=setup(async()=>{if(++n===2)throw new Error('fictional parser body');return result();});
  const a=await q.add(input(),{kind:'json',action:'format'}),b=await q.add(input(),{kind:'json',action:'format'}),old=q.getSnapshot();q.start(a);q.start(b);await tick();
  expect(old.items.every(i=>i.status==='ready')).toBe(true);expect(q.getSnapshot().items[0]?.result).toEqual(result());expect(q.getSnapshot().items[1]).toMatchObject({status:'failed',errorCode:'structure'});q.dispose();
});
it('shares task and source caps with legacy and AI owners',async()=>{
  const {q,budget}=setup(),tasks=Array.from({length:50},(_,i)=>budget.reserveTask(`fictional-${i}`));
  await expect(q.add(input(),{kind:'inspect',structural:false})).rejects.toThrow();tasks.forEach(t=>t.release());
  const source=budget.reserve('source',200*1024**2,'fictional-ai');await expect(q.add(input(),{kind:'inspect',structural:false})).rejects.toThrow();
  expect(budget.getUsage().tasks).toBe(0);source.release();q.dispose();
});
