import {invoke} from '@tauri-apps/api/core';
import type {OcrLanguage} from '../../core/ocr/types';
import {runOcrPages,type PixelEngine} from '../../core/ocr/pipeline';
import type {InputFile} from '../../core/conversion/types';
import type {ResourceBudget} from '../../core/resources/budget';
export interface NativeOcrInfo{id:string;installedLanguages:string[];modes:OcrLanguage[];maxSide:number;englishFallback:boolean}
export const nativeOcrInfo=()=>invoke<NativeOcrInfo>('ocr_info');
export async function processDesktopOcr(input:InputFile,language:OcrLanguage,signal:AbortSignal,onProgress:(page:number,count:number)=>void,budget:ResourceBudget){
 signal.throwIfAborted();const info=await nativeOcrInfo();if(!info.modes.includes(language))throw Error('ocr_language_missing');const id=await invoke<string>('ocr_begin',{language});
 const cancel=()=>{void invoke('ocr_cancel',{id}).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
 try{
  const {openOcrSource}=await import('../../converters/ocr/source');const source=await openOcrSource(input,info.maxSide,signal,budget);
  const engine:PixelEngine={async recognize(pixels,signal){signal.throwIfAborted();return invoke<string>('ocr_pixels',pixels.bytes,{headers:{'x-fileflow-ocr':id,'x-fileflow-width':String(pixels.width),'x-fileflow-height':String(pixels.height)}});}};
  return await runOcrPages(source,engine,signal,onProgress);
 }finally{signal.removeEventListener('abort',cancel);await invoke('ocr_finish',{id});}
}
