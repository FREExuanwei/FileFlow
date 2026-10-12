import {useEffect,useMemo,useRef,useState} from 'react';
import {renderPdfPreview} from '../../converters/pdf-tools/preview';
import {PdfPixelCache} from '../../converters/pdf-tools/cache';
import type {ResourceBudget,MemoryLease} from '../../core/resources/budget';
import type {ExecutionGate} from '../../core/resources/execution';
import {useI18n} from '../../i18n/Provider';
export function PdfPreview({blob,page,resources}:{blob:Blob;page:number;resources:{budget:ResourceBudget;execution:ExecutionGate}}){
 const ref=useRef<HTMLCanvasElement>(null),[state,setState]=useState('loading'),{language}=useI18n();
 const cache=useMemo(()=>new PdfPixelCache(resources.budget),[resources.budget]);
 useEffect(()=>()=>cache.clear(),[blob,cache]);
 useEffect(()=>{
  const controller=new AbortController(),canvas=ref.current;let display:MemoryLease|undefined;setState('loading');
  async function render(){let cleanup:(()=>void)|undefined,pixelLease:MemoryLease|undefined;try{
   let pixels=cache.get(page);
   if(!pixels){const temporary=document.createElement('canvas');cleanup=await renderPdfPreview(blob,page,temporary,controller.signal,resources);controller.signal.throwIfAborted();const ctx=temporary.getContext('2d');if(!ctx)throw Error('resource-limit');pixelLease=resources.budget.reserve('transient',temporary.width*temporary.height*4,'pdf-preview-copy');pixels=ctx.getImageData(0,0,temporary.width,temporary.height);}
   controller.signal.throwIfAborted();if(!canvas)return;
   display=resources.budget.reserve('transient',pixels.data.byteLength*3,'pdf-preview-display');canvas.width=pixels.width;canvas.height=pixels.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('resource-limit');ctx.putImageData(pixels,0,0);
   if(pixelLease)cache.set(page,pixels);setState('ready');
  }catch{display?.release();display=undefined;if(!controller.signal.aborted)setState('failed');}finally{pixelLease?.release();cleanup?.();}}
  if(canvas)void render();
  return()=>{controller.abort();display?.release();if(canvas){canvas.width=0;canvas.height=0;}};
 },[blob,page,resources,cache]);
 return <div className="pdf-preview">{state==='loading'&&<p role="status">{language==='zh-CN'?'正在加载页面…':'Loading page…'}</p>}{state==='failed'&&<p role="alert">{language==='zh-CN'?'此页无法预览。可移除该文件，或检查页面内容后重试。':'This page could not be previewed. Remove the file or check its contents and retry.'}</p>}<canvas ref={ref} aria-label={language==='zh-CN'?`第 ${page} 页预览`:`Page ${page} preview`}/><span className="small-note">{language==='zh-CN'?'预览画布最多 100 万像素；超过 2400 万像素的内嵌图片可能不显示。导出保留静态页面内容。':'Preview canvas is capped at 1 megapixel; embedded images over 24 megapixels may be omitted from preview. Export preserves static page content.'}</span></div>;
}
