import {describe,it,expect} from 'vitest';
import {runOcrPages,exportOcr,fitOcrRaster,type OcrPageSource,type PixelEngine} from '../../src/core/ocr/pipeline';
const signal=()=>new AbortController();
describe('desktop OCR orchestration',()=>{
 it('reuses a reliable text page, recognizes only scanned pages, keeps page order and releases each page',async()=>{
  const released:number[]=[],seen:number[]=[];const source:OcrPageSource={pageCount:3,async page(n){return{number:n,text:n===2?'A complete reliable fictional text layer.':'',reliable:n===2,async pixels(){seen.push(n);return{width:1,height:1,bytes:new Uint8Array(4)};},release(){released.push(n);}};},close:async()=>{released.push(0);}};
  const engine:PixelEngine={async recognize(){return '虚构 OCR';}};const result=await runOcrPages(source,engine,signal().signal,()=>{});
  expect(seen).toEqual([1,3]);expect(released).toEqual([1,2,3,0]);expect(result.pages.map(p=>p.number)).toEqual([1,2,3]);expect(result.pages.map(p=>p.origin)).toEqual(['ocr','text-layer','ocr']);expect(result.partial).toBe(false);expect(exportOcr(result,'txt')).toContain('[Page 2]');
 });
 it('retains successful pages and explicitly labels a failed middle page in both exports',async()=>{
  const source:OcrPageSource={pageCount:3,async page(n){return{number:n,reliable:false,text:'',async pixels(){if(n===2)throw Error('render');return{width:1,height:1,bytes:new Uint8Array(4)};},release(){}};},close:async()=>{}};
  const r=await runOcrPages(source,{recognize:async()=>'<script>fiction</script>'},signal().signal,()=>{});
  expect(r.partial).toBe(true);expect(r.pages[2]?.text).toContain('fiction');expect(exportOcr(r,'txt')).toContain('[Page 2: failed]');expect(exportOcr(r,'md')).toContain('Partial result');expect(exportOcr(r,'md')).toContain('\\<script\\>');
 });
 it('cancellation settles and closes the source without starting the next page',async()=>{
  const c=signal(),calls:number[]=[],closed:number[]=[];const source:OcrPageSource={pageCount:2,async page(n){calls.push(n);return{number:n,text:'',reliable:false,async pixels(){return{width:1,height:1,bytes:new Uint8Array(4)};},release(){closed.push(n);}};},close:async()=>{closed.push(0);}};
  await expect(runOcrPages(source,{recognize:async()=>{c.abort();return 'obsolete';}},c.signal,()=>{})).rejects.toThrow();expect(calls).toEqual([1]);expect(closed).toEqual([1,0]);
 });
 it('caps raster side and pixels without increasing small images',()=>{expect(fitOcrRaster(100,200,4096)).toEqual({width:100,height:200});const r=fitOcrRaster(10000,10000,4096);expect(r.width*r.height).toBeLessThanOrEqual(6000000);expect(r.width).toBeLessThanOrEqual(4096);expect(()=>fitOcrRaster(Infinity,4,4096)).toThrow();});
 it('rejects excessive physical pages before acquiring any page and closes the document',async()=>{let closed=false;const s:OcrPageSource={pageCount:101,page:async()=>{throw Error('must not run');},close:async()=>{closed=true;}};await expect(runOcrPages(s,{recognize:async()=>''},signal().signal,()=>{})).rejects.toThrow('resource-limit');expect(closed).toBe(true);});
 it('keeps earlier successful pages when a later page exceeds a resource limit',async()=>{const released:number[]=[];const s:OcrPageSource={pageCount:3,page:async n=>({number:n,text:'',reliable:false,pixels:async()=>{if(n===2)throw Error('resource-limit');return{width:1,height:1,bytes:new Uint8Array(4)};},release(){released.push(n);}}),close:async()=>{released.push(0);}};const r=await runOcrPages(s,{recognize:async()=> 'fictional retained text'},signal().signal,()=>{});expect(r.partial).toBe(true);expect(r.pages.map(p=>p.status)).toEqual(['completed','failed','completed']);expect(r.pages[0]?.text).toContain('retained');expect(released).toEqual([1,2,3,0]);});
 it('does not OCR beyond 50 pages and exports a marked partial result without losing the first 50',async()=>{let calls=0;const s:OcrPageSource={pageCount:51,page:async n=>({number:n,text:'',reliable:false,pixels:async()=>({width:1,height:1,bytes:new Uint8Array(4)}),release(){}}),close:async()=>{}};const r=await runOcrPages(s,{recognize:async()=>{calls++;return 'fictional';}},signal().signal,()=>{});expect(calls).toBe(50);expect(r.partial).toBe(true);expect(r.pages[50]?.status).toBe('failed');expect(exportOcr(r,'txt')).toContain('[Page 51: failed]');});
});
