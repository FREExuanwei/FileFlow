import { expect,it } from 'vitest';
import { AiReadyQueue } from '../../src/core/ai-ready/queue';
import { ResourceBudget } from '../../src/core/resources/budget';
import { ExecutionGate } from '../../src/core/resources/execution';
import { analyzeDocument } from '../../src/core/ai-ready/analysis';
import { settingsForPreset } from '../../src/core/ai-ready/defaults';
import type { AiResult } from '../../src/core/ai-ready/types';
import { buildAiExport } from '../../src/core/ai-ready/export';
const file=()=>{const blob=new Blob(['# Fictional\n\nOriginal text.']);return {name:'fictional.txt',type:'text/plain',size:blob.size,blob};};
const document={sourceFormat:'txt' as const,pages:[{number:1,markdown:'# Fictional\n\nOriginal text.',lines:[],blank:false}],warnings:[]};
const tick=()=>new Promise(r=>setTimeout(r,5));
it('export_names_are_unique_across_formats_truncation_and_removal',async()=>{
  const q=new AiReadyQueue({budget:new ResourceBudget(),execution:new ExecutionGate(),run:async()=>analyzeDocument(document,settingsForPreset('balanced'))});
  const names=['report.md','report.txt','a'.repeat(95)+'first.md','a'.repeat(95)+'second.md'];
  await q.add(names.map(name=>({...file(),name,type:name.endsWith('.md')?'text/markdown':'text/plain'})));q.startAll();await tick();await tick();
  const jobs=q.getSnapshot().items,partNames=jobs.map(job=>buildAiExport(job.result!,job.name,job.resultSettings!,('exportOrdinal' in job?job.exportOrdinal:0) as number).find(f=>f.kind==='chunk')!.name);
  expect(new Set(partNames).size).toBe(4);
  q.remove(jobs[0]!.id);const survivor=q.getSnapshot().items[0]!;
  expect(buildAiExport(survivor.result!,survivor.name,survivor.resultSettings!,('exportOrdinal' in survivor?survivor.exportOrdinal:0) as number).find(f=>f.kind==='chunk')!.name).toBe(partNames[1]);q.dispose();
});
it('line_dense_document_is_rejected_before_unreserved_analysis',async()=>{
  const dense={...document,pages:[{number:1,markdown:'x\n'.repeat(3_000_000),lines:[],blank:false}]};let analyzed=false;
  const budget=new ResourceBudget(),q=new AiReadyQueue({budget,execution:new ExecutionGate(),run:async(_file,_extracted,settings,options)=>{options.onExtracted?.(dense);analyzed=true;return analyzeDocument(document,settings);}});
  await q.add([file()]);q.startAll();await tick();expect(analyzed).toBe(false);expect(q.getSnapshot().items[0]!.error).toBe('resource-limit');q.dispose();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});
});
it('late_same_name_result_never_replaces_new_task_and_slots_wait_for_settlement',async()=> {
  let finish:(result:AiResult)=>void=()=>{};const budget=new ResourceBudget(),execution=new ExecutionGate();
  const q=new AiReadyQueue({budget,execution,run:async()=>new Promise(resolve=>{finish=resolve;})});
  await q.add([file()]);const id=q.getSnapshot().items[0]!.id;q.start(id);await tick();q.remove(id);
  expect(budget.getUsage().sourceBytes).toBeGreaterThan(0);expect(execution.tryAcquire('other',true)).toBeUndefined();
  await q.add([file()]);finish(analyzeDocument(document,settingsForPreset('balanced')));await tick();
  expect(q.getSnapshot().items).toHaveLength(1);expect(q.getSnapshot().items[0]!.id).not.toBe(id);expect(q.getSnapshot().items[0]!.result).toBeUndefined();q.clear();expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});
});
it('reanalyze_uses_retained_pages_and_failed_reclean_preserves_previous_chunks',async()=> {
  const seen:boolean[]=[];let fail=false;
  const q=new AiReadyQueue({budget:new ResourceBudget(),execution:new ExecutionGate(),run:async(_file,extracted,settings,options)=>{seen.push(!!extracted);options.onExtracted?.(document);if(fail)throw new Error('fictional internal path');return analyzeDocument(document,settings);}});
  await q.add([file()]);const id=q.getSnapshot().items[0]!.id;q.start(id);await tick();const result=q.getSnapshot().items[0]!.result;
  expect(q.getSnapshot().items[0]!.input).toBeUndefined();q.configure(id,settingsForPreset('conservative'));fail=true;q.start(id);await tick();
  expect(seen).toEqual([false,true]);expect(q.getSnapshot().items[0]!.result).toBe(result);expect(q.getSnapshot().items[0]!.error).not.toContain('path');q.dispose();
});
it('clear_during_pending_import_does_not_publish',async()=> {
  const budget=new ResourceBudget(),q=new AiReadyQueue({budget,execution:new ExecutionGate()});const task=q.add([file(),file()]);q.clear();await task;expect(q.getSnapshot().items).toEqual([]);expect(budget.getUsage()).toEqual({tasks:0,sourceBytes:0,resultBytes:0});q.dispose();
});
