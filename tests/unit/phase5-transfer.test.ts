import {expect,it,vi} from 'vitest';
import {ConversionQueue} from '../../src/core/queue/store';
import {Phase5Queue} from '../../src/core/phase5/queue';
import {transferReady} from '../../src/core/phase5/transfer';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
const input=()=>{const blob=new Blob(['name,value\nFiction,42']);return{name:'fiction.csv',type:'text/csv',size:blob.size,blob};};
const setup=()=>{const budget=new ResourceBudget(),execution=new ExecutionGate(),legacy=new ConversionQueue({budget,execution}),phase5=new Phase5Queue({budget,execution,run:vi.fn()});return{budget,legacy,phase5};};
it('ready transfer at50-task capacity keeps exact source identity and one owner',async()=>{
  const {budget,legacy,phase5}=setup(),file=input();await legacy.add(Array.from({length:50},(_,i)=>i===0?file:input()));const before=budget.getUsage(),id=legacy.getSnapshot().items[0]!.id,source=legacy.stageReadyTransfer(id)!;expect(source.value.input).toBe(file);const target=phase5.stageReadyReceive(source.value,{kind:'route',routeId:'csv-to-tsv'})!;expect(budget.getUsage()).toEqual(before);expect(legacy.getSnapshot().items).toHaveLength(50);expect(transferReady(source,target)).toBe(true);expect(legacy.getSnapshot().items).toHaveLength(49);expect(phase5.getSnapshot().items).toHaveLength(1);expect(phase5.getSnapshot().items[0]!.input).toBe(file);expect(budget.getUsage()).toEqual(before);legacy.dispose();phase5.dispose();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});
});
it('failed destination commit rolls source back without notifications or lease loss',async()=>{
  const {budget,legacy,phase5}=setup();await legacy.add([input()]);const original=legacy.getSnapshot(),before=budget.getUsage(),source=legacy.stageReadyTransfer(original.items[0]!.id)!,listener=vi.fn();legacy.subscribe(listener);expect(transferReady(source,{value:source.value,commit(){throw Error('fiction');},rollback:vi.fn(),publish:vi.fn()})).toBe(false);expect(legacy.getSnapshot()).toBe(original);expect(budget.getUsage()).toEqual(before);expect(listener).not.toHaveBeenCalled();legacy.dispose();phase5.dispose();
});
it('publication failure cannot roll back committed ownership',async()=>{
  const {budget,legacy,phase5}=setup();await legacy.add([input()]);const source=legacy.stageReadyTransfer(legacy.getSnapshot().items[0]!.id)!,target=phase5.stageReadyReceive(source.value,{kind:'route',routeId:'csv-to-tsv'})!;expect(target).toBeDefined();const publish=target.publish;target.publish=()=>{publish();throw Error('fiction');};expect(transferReady(source,target)).toBe(true);expect(legacy.getSnapshot().items).toHaveLength(0);expect(phase5.getSnapshot().items).toHaveLength(1);expect(budget.getUsage().tasks).toBe(1);legacy.dispose();phase5.dispose();
});
it('shared source and queued/processing/result tasks cannot transfer',async()=>{
  const {legacy,phase5}=setup(),file=input();await legacy.add([file,file]);expect(legacy.stageReadyTransfer(legacy.getSnapshot().items[0]!.id)).toBeUndefined();legacy.clear();await legacy.add([input()]);const id=legacy.getSnapshot().items[0]!.id;legacy.start(id);expect(legacy.stageReadyTransfer(id)).toBeUndefined();legacy.dispose();phase5.dispose();
});
it('reverse transfer only admits compatible legacy CSV/JSON routes',async()=>{
  const {budget,legacy,phase5}=setup(),file=input(),id=await phase5.add(file,{kind:'route',routeId:'csv-to-tsv'}),source=phase5.stageReadyTransfer(id)!;expect(legacy.stageReadyReceive(source.value,'md')).toBeUndefined();const target=legacy.stageReadyReceive(source.value,'json')!;expect(transferReady(source,target)).toBe(true);expect(legacy.getSnapshot().items[0]).toMatchObject({format:'csv',target:'json',status:'ready'});expect(budget.getUsage().tasks).toBe(1);legacy.dispose();phase5.dispose();
});
