import { analyzeDocument } from '../core/ai-ready/analysis';
import { AiError,type AiSettings,type ExtractedDocument } from '../core/ai-ready/types';
const scope=self as unknown as {onmessage:((event:MessageEvent<{generation:number;document:ExtractedDocument;settings:AiSettings}>)=>void)|null;postMessage:(message:unknown)=>void};
scope.onmessage=event=> {
  const {generation,document,settings}=event.data;
  try {const result=analyzeDocument(document,settings,stage=>scope.postMessage({generation,type:'stage',stage}));scope.postMessage({generation,type:'result',result});}
  catch(error){scope.postMessage({generation,type:'error',code:error instanceof AiError?error.code:'worker-failed'});}
};
