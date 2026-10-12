import { DocumentCleanupPipeline } from './cleanup/pipeline';
import { parseBlocks,buildOutline } from './structure';
import { measureDocument } from './tokens';
import { chunkDocument } from './chunking';
import { AiError,type AiChunk,type AiResult,type AiStage,type ExtractedDocument,type AiSettings } from './types';
import { TEXT_LIMIT } from './limits';
import {AUTO_CHUNK_THRESHOLD} from './recommendation';
export function analyzeDocument(document:ExtractedDocument,settings:AiSettings,onStage:(stage:AiStage)=>void=()=>{}):AiResult {
  if(document.pages.reduce((sum,p)=>sum+p.markdown.length,0)>TEXT_LIMIT)throw new AiError('text-limit');
  onStage('cleaning');const cleaned=DocumentCleanupPipeline.run(document,settings);
  onStage('structure');const outline=buildOutline(cleaned.markdown,parseBlocks(cleaned.markdown));
  onStage('estimating');const before=measureDocument(document.pages.map(p=>p.markdown).join('\n\n')),after=measureDocument(cleaned.markdown);
  onStage('chunking');
  let chunks:AiChunk[];
  if(settings.chunking.strategy==='auto'){
    if(!cleaned.markdown.trim())throw new AiError('no-content');
    // Resolve UX policy here. Existing manual chunk algorithms remain untouched.
    chunks=after.estimatedTokens<=AUTO_CHUNK_THRESHOLD?[{id:'part-001',ordinal:1,primary:{start:0,end:cleaned.markdown.length},estimatedTokens:after.estimatedTokens,outlineIds:outline.map(h=>h.id),warnings:[]}]:chunkDocument(cleaned.markdown,{strategy:'headings',targetEstimatedTokens:4000,overlapPercent:0});
  }else chunks=chunkDocument(cleaned.markdown,settings.chunking);
  return {extracted:document,cleaned,before,after,outline,chunks};
}
