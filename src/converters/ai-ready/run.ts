import type { InputFile } from '../../core/conversion/types';
import { AiError,type AiResult,type AiSettings,type ExtractedDocument } from '../../core/ai-ready/types';
import { extractAiDocument } from './extract';
import { analyzeAiDocument,type AnalysisOptions } from './worker';
export async function runAiReady(file:InputFile|undefined,extracted:ExtractedDocument|undefined,settings:AiSettings,options:AnalysisOptions):Promise<AiResult> {
  if(options.signal.aborted)throw new AiError('cancelled');
  let document=extracted;
  if(!document){if(!file)throw new AiError('empty-input');options.onStage?.('extracting');document=await extractAiDocument(file,{signal:options.signal});}
  if(options.signal.aborted)throw new AiError('cancelled');options.onExtracted?.(document);
  return analyzeAiDocument(document,settings,options);
}
