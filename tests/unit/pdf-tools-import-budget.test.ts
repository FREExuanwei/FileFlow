// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {PdfToolsStore} from '../../src/core/pdf-tools/store';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
it('returns admission before parsing so native chunk/File-copy allocation can settle',async()=>{
 const budget=new ResourceBudget(),run=vi.fn(async()=>({info:[{pages:[{width:300,height:400,rotation:0}],annotations:false}],outputs:[]})),store=new PdfToolsStore({budget,execution:new ExecutionGate(),run});
 const transient=budget.reserve('transient',82*1024**2,'fictional-native-import');const blob=new Blob([new Uint8Array(40*1024**2)]);
 await store.add([{name:'fictional.pdf',size:blob.size,type:'application/pdf',blob}]);expect(run).not.toHaveBeenCalled();expect(budget.getTransientUsage()).toBe(82*1024**2);
 transient.release();await new Promise(resolve=>setTimeout(resolve,0));expect(run).toHaveBeenCalledTimes(1);expect(store.getSnapshot().entries[0]?.info).toBeDefined();expect(store.getSnapshot().error).toBeUndefined();store.dispose();expect(budget.getTransientUsage()).toBe(0);
});
