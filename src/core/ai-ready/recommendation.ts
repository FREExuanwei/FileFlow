import type {AiResult} from './types';
/** Application UX threshold, unrelated to any model's context window or billing. */
export const AUTO_CHUNK_THRESHOLD=16000;
export type RecommendationKind='none'|'clean'|'chunk'|'clean-and-chunk';
export function recommendDocument(result:Pick<AiResult,'before'|'after'|'cleaned'|'extracted'>):{kind:RecommendationKind;alreadyClean:boolean}{
  const stats=result.cleaned.stats,edits=Object.values(stats).reduce((sum,n)=>sum+n,0);
  const reduction=(result.before.estimatedTokens-result.after.estimatedTokens)/Math.max(1,result.before.estimatedTokens);
  const clean=stats.headersRemoved+stats.footersRemoved>0||stats.linesMerged>=Math.max(5,Math.ceil(result.before.paragraphs*.2))||stats.blankLinesRemoved>=Math.max(10,Math.ceil(result.before.paragraphs*.1))||edits>0&&reduction>=.02;
  const chunk=result.after.estimatedTokens>AUTO_CHUNK_THRESHOLD;
  const uncertain=result.extracted.warnings.some(w=>w.code==='blank-pages');
  return{kind:clean?(chunk?'clean-and-chunk':'clean'):(chunk?'chunk':'none'),alreadyClean:!clean&&!uncertain};
}
