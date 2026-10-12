import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type {TextItem} from 'pdfjs-dist/types/src/display/api';
import type {InputFile} from '../../core/conversion/types';
import type {ResourceBudget} from '../../core/resources/budget';
import {imageDimensions,validateDimensions} from '../image/dimensions';
import {fitOcrRaster,type OcrPageSource,type OcrPixels} from '../../core/ocr/pipeline';
GlobalWorkerOptions.workerSrc=workerUrl;
const MiB=1024**2;
export async function openOcrSource(input:InputFile,maxSide:number,signal:AbortSignal,budget:ResourceBudget):Promise<OcrPageSource>{
 signal.throwIfAborted();const ext=input.name.split('.').pop()?.toLowerCase(),kind=ext==='jpg'?'jpeg':ext;
 if(!['pdf','png','jpeg','webp'].includes(kind??'')||!input.size||input.size!==input.blob.size||input.size>100*MiB)throw Error('ocr_file_limit');
 const head=new Uint8Array(await input.blob.slice(0,MiB).arrayBuffer());signal.throwIfAborted();
 const mime=input.type.split(';')[0];if(mime&&mime!=='application/octet-stream'&&mime!==(kind==='pdf'?'application/pdf':`image/${kind}`)&&!(kind==='jpeg'&&mime==='image/jpg'))throw Error('invalid-file');
 if(kind!=='pdf'){
  const sig=kind==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>head[i]===v):kind==='jpeg'?head[0]===255&&head[1]===216&&head[2]===255:new TextDecoder().decode(head.subarray(0,4))==='RIFF'&&new TextDecoder().decode(head.subarray(8,12))==='WEBP';if(!sig)throw Error('invalid-file');
  const dimensions=imageDimensions(head,kind as 'png'|'jpeg'|'webp');let closed=false;
  return{pageCount:1,async page(number){if(closed||number!==1)throw Error('invalid-file');let canvas:HTMLCanvasElement|undefined;let lease:ReturnType<ResourceBudget['reserve']>|undefined;
   return{number,text:'',reliable:false,async pixels():Promise<OcrPixels>{signal.throwIfAborted();const fit=fitOcrRaster(dimensions.width,dimensions.height,maxSide);lease=budget.reserve('transient',dimensions.width*dimensions.height*4+fit.width*fit.height*4*5+16*MiB,'ocr-image');const bitmap=await createImageBitmap(input.blob);try{signal.throwIfAborted();validateDimensions(bitmap.width,bitmap.height);if(bitmap.width!==dimensions.width||bitmap.height!==dimensions.height)throw Error('invalid-file');canvas=document.createElement('canvas');canvas.width=fit.width;canvas.height=fit.height;const context=canvas.getContext('2d');if(!context)throw Error('resource-limit');context.fillStyle='white';context.fillRect(0,0,fit.width,fit.height);context.drawImage(bitmap,0,0,fit.width,fit.height);const image=context.getImageData(0,0,fit.width,fit.height);return{...fit,bytes:new Uint8Array(image.data.buffer)};}finally{bitmap.close();}},release(){if(canvas){canvas.width=0;canvas.height=0;}lease?.release();}};
  },async close(){closed=true;}};
 }
 if(!new TextDecoder().decode(head.subarray(0,1024)).includes('%PDF-'))throw Error('invalid-file');
 const dataLease=budget.reserve('transient',input.size,'ocr-pdf');let task:ReturnType<typeof getDocument>|undefined;
 try{
  const data=new Uint8Array(await input.blob.arrayBuffer());signal.throwIfAborted();const assets=new URL(`${import.meta.env.BASE_URL}pdf-assets/`,document.baseURI).href;
  task=getDocument({data,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,cMapUrl:`${assets}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assets}standard_fonts/`,wasmUrl:`${assets}wasm/`,verbosity:0});const loading=task;const abort=()=>{void loading.destroy();};signal.addEventListener('abort',abort,{once:true});
  let pdf:Awaited<typeof task.promise>;try{pdf=await task.promise;}catch(error){signal.removeEventListener('abort',abort);throw error;}
  return{pageCount:pdf.numPages,async page(number){signal.throwIfAborted();const page=await pdf.getPage(number);let canvas:HTMLCanvasElement|undefined;let lease:ReturnType<ResourceBudget['reserve']>|undefined;
   try{const viewport=page.getViewport({scale:1});if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0||viewport.width>100000||viewport.height>100000)throw Error('resource-limit');const content=await page.getTextContent();const items=content.items.filter((i):i is TextItem=>'str'in i);const visible=items.filter(i=>i.str.trim()&&i.width>0&&i.height>0&&(i.transform[4]??-1)>=0&&(i.transform[4]??Infinity)<=viewport.width&&(i.transform[5]??-1)>=0&&(i.transform[5]??Infinity)<=viewport.height);const text=visible.map(i=>i.str+(i.hasEOL?'\n':' ')).join('').trim();const bad=[...text].filter(c=>c.charCodeAt(0)<9||c==='\uFFFD').length;const central=visible.filter(i=>(i.transform[5]??0)>viewport.height*.12&&(i.transform[5]??0)<viewport.height*.88).reduce((n,i)=>n+i.str.trim().length,0);const reliable=central>=24&&text.length>=32&&bad/Math.max(1,text.length)<.01;
    return{number,text,reliable,async pixels(){signal.throwIfAborted();const fit=fitOcrRaster(viewport.width*2,viewport.height*2,maxSide);lease=budget.reserve('transient',fit.width*fit.height*4*5+16*MiB,'ocr-pdf-page');canvas=document.createElement('canvas');canvas.width=fit.width;canvas.height=fit.height;const context=canvas.getContext('2d');if(!context)throw Error('resource-limit');const render=page.render({canvas,canvasContext:context,viewport:page.getViewport({scale:fit.width/viewport.width}),background:'rgb(255,255,255)'});const cancelRender=()=>render.cancel();signal.addEventListener('abort',cancelRender,{once:true});try{await render.promise;signal.throwIfAborted();const image=context.getImageData(0,0,fit.width,fit.height);return{...fit,bytes:new Uint8Array(image.data.buffer)};}finally{signal.removeEventListener('abort',cancelRender);}},release(){if(canvas){canvas.width=0;canvas.height=0;}lease?.release();page.cleanup();}};
   }catch(error){page.cleanup();throw error;}
  },async close(){signal.removeEventListener('abort',abort);try{await loading.destroy();}finally{dataLease.release();}}};
 }catch(error){if(task)await task.destroy().catch(()=>{});dataLease.release();throw error;}
}
