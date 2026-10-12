import { expect,it,vi } from 'vitest';
import { AiDownloadController } from '../../src/adapters/web/ai-ready-downloads';
import { ResourceBudget } from '../../src/core/resources/budget';
import type { ExportFile } from '../../src/core/ai-ready/types';
const files:ExportFile[]=[1,2,3].map(i=>({id:`part-${i}`,name:`part-${i}.md`,kind:'chunk',mime:'text/markdown',estimatedTransientBytes:100,readText:()=>`fictional ${i}`}));
it('explicit_batch_error_keeps_files_and_individual_downloads',async()=>{
  vi.useFakeTimers();const states:string[]=[];let calls=0,fail=true;const budget=new ResourceBudget();
  const output={save:vi.fn(()=>{calls++;if(fail&&calls===2)throw new Error('blocked');}),dispose:vi.fn()};
  const c=new AiDownloadController({output,budget,onChange:s=>states.push(s.phase)});const task=c.start(files,()=>true);await vi.runAllTimersAsync();await task;
  expect(states.at(-1)).toBe('error');expect(files.map(f=>f.readText())).toEqual(['fictional 1','fictional 2','fictional 3']);fail=false;c.saveOne(files[1]!);c.saveOne(files[2]!);expect(calls).toBe(4);c.dispose();expect(budget.getUsage().resultBytes).toBe(0);vi.useRealTimers();
});
it('silent_block_is_not_reported_as_saved_and_stop_disposes_resources',async()=>{
  vi.useFakeTimers();const states:string[]=[];const budget=new ResourceBudget(),c=new AiDownloadController({output:{save:()=>{},dispose:()=>{}},budget,onChange:s=>states.push(s.phase)});
  const task=c.start(files,()=>true);await vi.runAllTimersAsync();await task;expect(states.at(-1)).toBe('requests-sent');expect(states).not.toContain('success');c.dispose();expect(budget.getUsage().resultBytes).toBe(0);vi.useRealTimers();
});
it('invalidated_batch_resets_requesting_state_without_losing_files',async()=>{
  vi.useFakeTimers();const states:string[]=[];let valid=true;const c=new AiDownloadController({output:{save:()=>{valid=false;},dispose:()=>{}},budget:new ResourceBudget(),onChange:s=>states.push(s.phase)});
  const task=c.start(files,()=>valid);await vi.runAllTimersAsync();await task;expect(states.at(-1)).toBe('stopped');expect(files).toHaveLength(3);c.dispose();vi.useRealTimers();
});
