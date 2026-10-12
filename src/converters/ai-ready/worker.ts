import { AiError,type AiErrorCode,type AiResult,type AiSettings,type AiStage,type ExtractedDocument } from '../../core/ai-ready/types';
import { validateSettings } from '../../core/ai-ready/defaults';
import { TEXT_LIMIT } from '../../core/ai-ready/limits';
export interface AnalysisOptions { signal:AbortSignal;generation:number;onStage?:(stage:AiStage)=>void;onExtracted?:(document:ExtractedDocument)=>void }
export function analyzeAiDocument(document:ExtractedDocument,settings:AiSettings,options:AnalysisOptions):Promise<AiResult> {
  if(options.signal.aborted)return Promise.reject(new AiError('cancelled'));
  try{validateSettings(settings);if(document.pages.reduce((n,page)=>n+page.markdown.length,0)>TEXT_LIMIT)throw new AiError('text-limit');}catch(error){return Promise.reject(error);}
  return new Promise((resolve,reject)=> {
    let worker:Worker;
    try {worker=new Worker(new URL('../../workers/ai-ready.worker.ts',import.meta.url),{type:'module'});}catch{reject(new AiError('worker-failed'));return;}
    const cleanup=()=>{worker.terminate();clearTimeout(timer);options.signal.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new AiError('cancelled'));};
    const timer=setTimeout(()=>{cleanup();reject(new AiError('timeout'));},60000);
    options.signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=(event:MessageEvent<{generation:number;type:'stage'|'result'|'error';stage:AiStage;result:AiResult;code:AiErrorCode}>)=> {
      const message=event.data;if(message.generation!==options.generation||options.signal.aborted)return;
      if(message.type==='stage'){options.onStage?.(message.stage);return;}
      cleanup();if(message.type==='result')resolve(message.result);else reject(new AiError(message.code));
    };
    worker.onerror=()=>{cleanup();reject(new AiError('worker-failed'));};
    try {worker.postMessage({generation:options.generation,document,settings});}catch{cleanup();reject(new AiError('worker-failed'));}
  });
}
