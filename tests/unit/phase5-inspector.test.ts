import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ResourceBudget} from '../../src/core/resources/budget';
import {toP5Input} from '../../src/adapters/web/phase5-input';
import {inspectBasic} from '../../src/converters/phase5/inspect';
import {inspectPdfPages} from '../../src/converters/phase5/pdf-inspect';
const state=vi.hoisted(()=>({getDocument:vi.fn()}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs',()=>({getDocument:state.getDocument,GlobalWorkerOptions:{}}));
const context=()=>({taskId:'fictional',operationId:'inspect',generation:1,budget:new ResourceBudget(),signal:new AbortController().signal,onStage:vi.fn()});
beforeEach(()=>vi.clearAllMocks());
describe('Inspector metadata boundary',()=>{
  it('keeps only provided valid lastModified including epoch zero',()=>{
    for(const n of [0,123,-100])expect(toP5Input(new File(['fictional'],'x.bin',{lastModified:n})).lastModified).toBe(n);
    const file=new File(['fictional'],'x.bin');Object.defineProperty(file,'lastModified',{value:NaN});expect(toP5Input(file).lastModified).toBeUndefined();
  });
  it('basic mode does not read body, slice, metadata or fetch and does not invent lastModified',async()=>{
    const blob=new Blob(['fictional']),read=vi.spyOn(blob,'arrayBuffer'),text=vi.spyOn(blob,'text'),slice=vi.spyOn(blob,'slice');
    const result=await inspectBasic({name:'fictional.pdf',type:'application/pdf',size:blob.size,blob},false,context());
    expect(result.fields.lastModified).toBe('not-provided');expect(result.fields.signature).toBe('not-checked');expect(result.fields.author).toBe('not-checked');
    expect(read).not.toHaveBeenCalled();expect(text).not.toHaveBeenCalled();expect(slice).not.toHaveBeenCalled();expect(state.getDocument).not.toHaveBeenCalled();
  });
  it('sanitizes basename and caps report without exposing path',async()=>{
    const blob=new Blob(['x']);const result=await inspectBasic({name:'C:\\fictional\\<unsafe>\u202e'+ 'x'.repeat(300)+'.bin',type:'x'.repeat(400),size:1,blob},false,context());
    expect(String(result.fields.name)).not.toContain('fictional');expect(String(result.fields.name)).not.toContain('\u202e');expect(String(result.fields.name).length).toBeLessThan(130);expect(JSON.stringify(result).length).toBeLessThan(16384);
  });
  it('signature differs from untrusted declared MIME and unknown is explicit',async()=>{
    const blob=new Blob(['fictional unknown']);const result=await inspectBasic({name:'fake.png',type:'image/png',size:blob.size,blob},true,context());
    expect(result.fields.declaredMime).toBe('image/png');expect(result.fields.signature).toBe('unknown');expect(result.fields.mimeMatch).toBe(false);
  });
  it('uses bounded PNG header only and preserves source bytes',async()=>{
    const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);new DataView(bytes.buffer).setUint32(16,12);new DataView(bytes.buffer).setUint32(20,20);
    const blob=new Blob([bytes]),read=vi.spyOn(blob,'arrayBuffer');const result=await inspectBasic({name:'fictional.png',type:'image/png',size:24,blob},true,context());
    expect(result.fields).toMatchObject({signature:'png',width:12,height:20,mimeMatch:true});expect(read).not.toHaveBeenCalled();
  });
  it('rejects size mismatch, over40MiB and cancellation',async()=>{
    const blob=new Blob(['x']);await expect(inspectBasic({name:'x',type:'',size:2,blob},false,context())).rejects.toThrow();
    const large=new Blob([new Uint8Array(40*1024**2+1)]);await expect(inspectBasic({name:'x',type:'',size:large.size,blob:large},false,context())).rejects.toThrow();
    const c=context(),controller=new AbortController();controller.abort();await expect(inspectBasic({name:'x',type:'',size:1,blob},false,{...c,signal:controller.signal})).rejects.toMatchObject({code:'cancel'});
  });
});
describe('PDF page-only wrapper',()=>{
  it('never extracts or renders and destroys loading task once',async()=>{
    const pdf={numPages:2,getPage:vi.fn(),getMetadata:vi.fn()},destroy=vi.fn(async()=>{});state.getDocument.mockReturnValue({promise:Promise.resolve(pdf),destroy});
    const c=context();expect(await inspectPdfPages(new Blob(['%PDF-fictional']),c)).toBe(2);expect(pdf.getPage).not.toHaveBeenCalled();expect(pdf.getMetadata).not.toHaveBeenCalled();expect(destroy).toHaveBeenCalledTimes(1);expect(c.budget.getTransientUsage()).toBe(0);
    expect(state.getDocument.mock.calls[0]![0]).toMatchObject({enableXfa:false,disableAutoFetch:true,useSystemFonts:false,disableFontFace:true});
  });
  for(const pages of [0,501])it(`rejects ${pages} pages and destroys once`,async()=>{
    const destroy=vi.fn(async()=>{});state.getDocument.mockReturnValue({promise:Promise.resolve({numPages:pages}),destroy});await expect(inspectPdfPages(new Blob(['%PDF']),context())).rejects.toThrow();expect(destroy).toHaveBeenCalledTimes(1);
  });
  for(const name of ['PasswordException','InvalidPDFException'])it(`${name} maps closed error and destroys once`,async()=>{
    const destroy=vi.fn(async()=>{});state.getDocument.mockReturnValue({promise:Promise.reject(Object.assign(new Error('fictional parser content'),{name})),destroy});await expect(inspectPdfPages(new Blob(['%PDF']),context())).rejects.toMatchObject({code:'structure'});expect(destroy).toHaveBeenCalledTimes(1);
  });
  it('cancel settles by destroy exactly once and releases accounted memory',async()=>{
    let reject!:(e:unknown)=>void;const destroy=vi.fn(async()=>reject(new Error('cancelled')));state.getDocument.mockReturnValue({promise:new Promise((_,r)=>reject=r),destroy});
    const controller=new AbortController(),c={...context(),signal:controller.signal};const pending=inspectPdfPages(new Blob(['%PDF']),c);await vi.waitFor(()=>expect(state.getDocument).toHaveBeenCalled());controller.abort();await expect(pending).rejects.toMatchObject({code:'cancel'});expect(destroy).toHaveBeenCalledTimes(1);expect(c.budget.getTransientUsage()).toBe(0);
  });
});
