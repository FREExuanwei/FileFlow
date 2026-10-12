import {afterEach,expect,it,vi} from 'vitest';
import {createJsonSession} from '../../src/converters/phase5/json';
import {openJsonWorkerSession} from '../../src/converters/phase5/json-worker';
import {ResourceBudget} from '../../src/core/resources/budget';
import type {P5RunContext} from '../../src/core/phase5/types';
it('parses_once_across_three_actions with exact format/minify and no validation Blob',()=>{
  const spy=vi.spyOn(JSON,'parse');try{
    const session=createJsonSession(' { "fictional": [1,true,null] } '),formatted=session.run('format'),minified=session.run('minify'),validated=session.run('validate');
    expect(spy).toHaveBeenCalledTimes(1);expect(formatted).toMatchObject({kind:'file',preview:'{\n  "fictional": [\n    1,\n    true,\n    null\n  ]\n}'});expect(minified).toMatchObject({kind:'file',preview:'{"fictional":[1,true,null]}'});
    expect(validated).toMatchObject({kind:'report',reportType:'validation',fields:{valid:true}});expect(validated).not.toHaveProperty('blob');session.dispose();expect(()=>session.run('format')).toThrow();
  }finally{spy.mockRestore();}
});
it('duplicate keys produce safe-subset diagnostic and reject rewrite',()=>{
  const session=createJsonSession('{"same":1,"same":2}');expect(session.run('validate')).toMatchObject({fields:{valid:false,code:'json-duplicate-key',subset:'FileFlow safe JSON subset'}});
  expect(()=>session.run('format')).toThrow();session.dispose();
});
it.each([
  ' '.repeat(2*1024**2+1),
  '['.repeat(65)+'0'+']'.repeat(65),
  '['+Array(100001).fill(0).join(',')+']',
  '"'+'x'.repeat(256*1024+1)+'"',
  '['.repeat(60)+'['+Array(70000).fill(0).join(',')+']'+']'.repeat(60),
])('rejects structured limits and expanded output',text=>{expect(()=>createJsonSession(text).run('format')).toThrow();});
it('does_not_render_entire_large_json',()=>{const session=createJsonSession(JSON.stringify({fictional:'x'.repeat(200000)}));expect(session.run('format')).toMatchObject({kind:'file'});const result=session.run('format');if(result.kind==='file')expect(result.preview.length).toBeLessThanOrEqual(50000);session.dispose();});
class FakeWorker extends EventTarget {
  static last:FakeWorker;terminated=vi.fn();posted:{taskId:string;operationId:string;generation:number;payload:unknown}[]=[];
  constructor(){super();FakeWorker.last=this;}
  postMessage(data:typeof this.posted[number]){this.posted.push(data);}
  terminate(){this.terminated();}
  emit(context:P5RunContext,payload:unknown){this.dispatchEvent(new MessageEvent('message',{data:{taskId:context.taskId,operationId:context.operationId,generation:context.generation,payload}}));}
}
const input=()=>({name:'fictional.json',type:'application/json',size:2,blob:new Blob(['{}'])});
function context(){const controller=new AbortController(),budget=new ResourceBudget();return{controller,budget,c:{taskId:'fictional',operationId:'one',generation:1,signal:controller.signal,budget,onStage:vi.fn()}};}
afterEach(()=>vi.unstubAllGlobals());
it('retains idle tree lease and invalidates old actions without reparsing source',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const {c,budget}=context(),opening=openJsonWorkerSession(input(),c),w=FakeWorker.last;
  w.emit(c,{type:'ready'});const session=await opening;expect(budget.getTransientUsage()).toBe(64*1024**2);
  const first=session.run('format',c),rejected=expect(first).rejects.toMatchObject({code:'stale'}),secondContext={...c,operationId:'two',generation:2},second=session.run('validate',secondContext);
  await rejected;w.emit(c,{type:'result',value:'obsolete'});w.emit(secondContext,{type:'result',value:{kind:'report',reportType:'validation',fields:{valid:true},notices:[]}});expect(await second).toMatchObject({kind:'report'});
  expect(w.posted.filter(message=>(message.payload as {type:string}).type==='json-open')).toHaveLength(1);session.dispose();session.dispose();expect(budget.getTransientUsage()).toBe(0);expect(w.terminated).toHaveBeenCalledTimes(1);
});
it('cancel removes session tree lease and prevents reuse',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const {c,budget,controller}=context(),opening=openJsonWorkerSession(input(),c),w=FakeWorker.last;w.emit(c,{type:'ready'});const session=await opening;
  const running=session.run('format',c);controller.abort();await expect(running).rejects.toMatchObject({code:'cancel'});expect(budget.getTransientUsage()).toBe(0);await expect(session.run('format',c)).rejects.toThrow();expect(w.terminated).toHaveBeenCalledTimes(1);
});
