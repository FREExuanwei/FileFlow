// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {ResourceBudget} from '../../src/core/resources/budget';
import {convertImage} from '../../src/converters/image/convert';
import {convertPdf} from '../../src/converters/pdf/convert';
vi.mock('../../src/converters/pdf/extract',()=>({extractPdf:vi.fn(async()=>({text:'fictional',pages:1,warnings:[]}))}));
const image=()=>{const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);new DataView(b.buffer).setUint32(16,1);new DataView(b.buffer).setUint32(20,1);return new Blob([b]);};
afterEach(()=>vi.unstubAllGlobals());
it('reserves decoded image and output canvas memory before decoding, refusing shared-budget overflow',async()=>{
 const budget=new ResourceBudget(),held=budget.reserve('transient',256*1024**2-1,'another-task'),decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);
 await expect(convertImage(image(),'png','jpeg',{resourceBudget:budget})).rejects.toThrow('resource-limit');expect(decode).not.toHaveBeenCalled();expect(budget.getTransientUsage()).toBe(256*1024**2-1);held.release();
});
it('releases processing memory and bitmap when canvas allocation fails',async()=>{
 const budget=new ResourceBudget(),close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:1,height:1,close})));const canvas=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 await expect(convertImage(image(),'png','jpeg',{resourceBudget:budget})).rejects.toThrow('canvas');expect(close).toHaveBeenCalledOnce();expect(budget.getTransientUsage()).toBe(0);canvas.mockRestore();
});
it('PDF buffer admission happens before reading a large blob and cancellation releases the lease',async()=>{
 const budget=new ResourceBudget(),held=budget.reserve('transient',240*1024**2,'another-task'),blob=new Blob(['%PDF fictional']),read=vi.spyOn(blob,'arrayBuffer');
 await expect(convertPdf(blob,'txt',{resourceBudget:budget})).rejects.toThrow('resource-limit');expect(read).not.toHaveBeenCalled();held.release();const c=new AbortController();c.abort();
 await expect(convertPdf(blob,'txt',{resourceBudget:budget,signal:c.signal})).rejects.toThrow();expect(budget.getTransientUsage()).toBe(0);
});
