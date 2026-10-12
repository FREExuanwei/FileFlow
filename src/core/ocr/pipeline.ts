import {OCR_LIMITS} from './limits';
export interface OcrPixels {width:number;height:number;bytes:Uint8Array}
export interface OcrSourcePage {number:number;text:string;reliable:boolean;pixels():Promise<OcrPixels>;release():void}
export interface OcrPageSource {pageCount:number;page(number:number):Promise<OcrSourcePage>;close():Promise<void>}
export interface PixelEngine {recognize(pixels:OcrPixels,signal:AbortSignal):Promise<string>}
export interface ProcessedPage {number:number;status:'completed'|'empty'|'failed';text:string;origin:'ocr'|'text-layer';error?:string}
export interface ProcessedOcr {pages:ProcessedPage[];partial:boolean}
export function fitOcrRaster(width:number,height:number,maxSide:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(maxSide)||maxSide<1)throw Error('resource-limit');
 const ratio=Math.min(1,Math.min(maxSide,OCR_LIMITS.rasterSide)/Math.max(width,height),Math.sqrt(OCR_LIMITS.rasterPixels/(width*height)));
 return{width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio))};
}
export async function runOcrPages(source:OcrPageSource,engine:PixelEngine,signal:AbortSignal,progress:(page:number,count:number)=>void):Promise<ProcessedOcr>{
 const pages:ProcessedPage[]=[];let ocrPages=0,units=0;
 try{
  if(!Number.isInteger(source.pageCount)||source.pageCount<1||source.pageCount>OCR_LIMITS.physicalPages)throw Error('resource-limit');
  for(let number=1;number<=source.pageCount;number++){
   signal.throwIfAborted();let page:OcrSourcePage|undefined;
   try{
    page=await source.page(number);signal.throwIfAborted();let text:string,origin:ProcessedPage['origin'];
    if(page.reliable){text=page.text;origin='text-layer';}
    else{if(++ocrPages>OCR_LIMITS.ocrPages)throw Error('resource-limit');text=await engine.recognize(await page.pixels(),signal);origin='ocr';}
    signal.throwIfAborted();if(text.length>OCR_LIMITS.pageTextUnits||units+text.length>OCR_LIMITS.documentTextUnits)throw Error('resource-limit');units+=text.length;
    pages.push({number,text,origin,status:text.trim()?'completed':'empty'});
   }catch(error){signal.throwIfAborted();pages.push({number,status:'failed',text:'',origin:'ocr',error:error instanceof Error&&error.message==='resource-limit'?'resource-limit':'page-recognition-failed'});}
   finally{page?.release();}
   progress(number,source.pageCount);await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(!pages.some(p=>p.status==='completed'))throw Error('no-readable-text');
  return{pages,partial:pages.some(p=>p.status!=='completed')};
 }finally{await source.close();}
}
export function exportOcr(result:ProcessedOcr,format:'txt'|'md'){
 const escape=(text:string)=>format==='md'?text.replace(/([\\`*_{}[\]<>#])/g,'\\$1'):text;
 const notice=result.partial?'[Partial result: some pages failed or contained no recognized text.]\n\n':'';
 return notice+result.pages.map(p=>p.status==='failed'?`[Page ${p.number}: failed]`:p.status==='empty'?`[Page ${p.number}: no recognized text]`:`${format==='md'?`## Page ${p.number}`:`[Page ${p.number}]`}\n\n${escape(p.text)}`).join('\n\n')+'\n';
}
