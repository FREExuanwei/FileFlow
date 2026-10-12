import { useEffect,useMemo,useRef,useState } from 'react';
import type { AiJob,AiReadyQueue } from '../../core/ai-ready/queue';
import { buildAiExport } from '../../core/ai-ready/export';
import { estimatedChange } from '../../core/ai-ready/tokens';
import { WebFileOutputAdapter } from '../../adapters/web/files';
import { AiDownloadController,type DownloadState } from '../../adapters/web/ai-ready-downloads';
import { useI18n } from '../../i18n/Provider';
import { AiDocumentView } from './DocumentView';
import { AiExportList } from './ExportList';
import {recommendDocument,AUTO_CHUNK_THRESHOLD} from '../../core/ai-ready/recommendation';
const summary=['headersRemoved','footersRemoved','pageNumbersRemoved','linesMerged','blankLinesRemoved','headingsNormalized','listsNormalized'] as const;
export function AiResults({job,queue}:{job:AiJob;queue:AiReadyQueue}){
  const {t,language}=useI18n(),[view,setView]=useState<'before'|'after'>('after'),[chunkId,setChunkId]=useState<string>(),[outlineId,setOutlineId]=useState<string>(),[downloadState,setDownloadState]=useState<DownloadState>({phase:'idle',requestsSent:0});
  const [downloads]=useState(()=>new AiDownloadController({output:new WebFileOutputAdapter(),budget:queue.budget,onChange:setDownloadState}));
  useEffect(()=>()=>downloads.dispose(),[downloads]);
  const result=job.result!;
  const recommendation=recommendDocument(result),parts=useRef<HTMLDetailsElement>(null);
  const showParts=job.resultSettings!.chunking.strategy!=='auto'||result.chunks.length>1||result.after.estimatedTokens>AUTO_CHUNK_THRESHOLD;
  const files=useMemo(()=>buildAiExport(result,job.name,job.resultSettings!,job.exportOrdinal),[result,job.name,job.resultSettings,job.exportOrdinal]);
  const change=estimatedChange(result.before.estimatedTokens,result.after.estimatedTokens);
  const number=(n:number)=>n.toLocaleString(language);
  const warnings=[...result.extracted.warnings,...result.cleaned.warnings];
  return <div className="ai-results">
    <section className="ai-recommendation" data-recommendation={recommendation.kind}><span>{t('aiRecommendation')}</span><h3>{t(recommendation.kind==='none'?(recommendation.alreadyClean?'aiRecNone':'aiStateReview'):recommendation.kind==='clean'?'aiRecClean':recommendation.kind==='chunk'?'aiRecChunk':'aiRecBoth')}</h3><p>{t(recommendation.kind==='none'?(recommendation.alreadyClean?'aiRecNoneNote':'aiRecReviewNote'):recommendation.kind==='clean'?'aiRecCleanNote':recommendation.kind==='chunk'?'aiRecChunkNote':'aiRecBothNote')}</p>{recommendation.alreadyClean&&<p className="ai-clean-note">{t('aiAlreadyClean')}</p>}<button className="primary full ai-recommended-action" onClick={()=>{if(recommendation.kind==='none'||recommendation.kind==='clean')downloads.saveOne(files.find(f=>f.kind==='clean')!);else if(parts.current){parts.current.open=true;parts.current.scrollIntoView({block:'nearest'});parts.current.querySelector<HTMLButtonElement>('button')?.focus();}}}>{t(recommendation.kind==='none'||recommendation.kind==='clean'?'aiExportWhole':'aiReviewChunks')}</button></section>
    {JSON.stringify(job.settings)!==JSON.stringify(job.resultSettings)&&<p className="warning">{t('aiChanged')}</p>}
    {warnings.map((warning,i)=><p className="warning ai-result-warning" key={i}>{t(`ai_warning_${warning.code}`,{count:warning.count??0})}</p>)}
    <div className="ai-token-summary">{(['before','after'] as const).map(side=><div key={side}><span>{t(side==='before'?'aiBefore':'aiAfter')}</span><strong>{t('aiEstimated',{count:number(result[side].estimatedTokens)})}</strong><p>{t('aiCharacters')}: {number(result[side].characters)}</p><p>{t('aiWords')}: {number(result[side].whitespaceDelimitedWords)}</p><p>{t('aiHeadingCount')}: {result[side].headings} · {t('aiParagraphs')}: {result[side].paragraphs}</p></div>)}</div>
    <p className="ai-change">{change.percent===undefined?t('aiEstimated',{count:number(result.after.estimatedTokens)}):change.direction==='same'?t('aiUnchanged'):t(change.direction==='decrease'?'aiDecrease':'aiIncrease',{percent:change.percent.toFixed(1)})}</p>
    <details className="ai-clean-summary"><summary>{t('aiSummary')}</summary><dl>{summary.map(key=><div key={key} data-stat={key}><dt>{t(`ai_${key}`)}</dt><dd>{number(result.cleaned.stats[key])}</dd></div>)}</dl></details>
    <div className="segmented ai-comparison"><button aria-pressed={view==='before'} onClick={()=>{setView('before');setChunkId(undefined);setOutlineId(undefined);}}>{t('aiBefore')}</button><button aria-pressed={view==='after'&&!chunkId} onClick={()=>{setView('after');setChunkId(undefined);setOutlineId(undefined);}}>{t('aiAfter')}</button></div>
    <AiDocumentView result={result} view={view} selectedChunkId={chunkId} outlineId={outlineId}/>
    <details className="ai-outline" open><summary>{t('aiOutline')}</summary>{result.outline.length?result.outline.map(h=><button key={h.id} className="text-button" style={{paddingInlineStart:`${(h.level-1)*10}px`}} onClick={()=>{setView('after');setChunkId(undefined);setOutlineId(h.id);}}>{h.title}</button>):<p className="small-note">{t('aiNoOutline')}</p>}</details>
    {showParts&&<details ref={parts} className="ai-chunks" open><summary>{t('aiChunks')} ({result.chunks.length})</summary>{result.chunks.map(chunk=><div key={chunk.id} className={`ai-chunk ${chunk.id===chunkId?'selected':''}`}><button className="ai-chunk-select" aria-label={t('aiPreviewChunk',{count:chunk.ordinal})} aria-pressed={chunk.id===chunkId} onClick={()=>{setView('after');setOutlineId(undefined);setChunkId(chunk.id);}}><strong>{t('aiPart',{count:chunk.ordinal})}</strong><span>{t('aiEstimated',{count:number(chunk.estimatedTokens)})}</span><small>{chunk.outlineIds.map(id=>result.outline.find(h=>h.id===id)?.title).join(' → ')||t('aiNoSections')}</small></button><button className="text-button" aria-label={t('aiDownloadOne',{name:files.find(f=>f.id===chunk.id)!.name})} onClick={()=>downloads.saveOne(files.find(f=>f.id===chunk.id)!)}>{t('download')}</button>{chunk.warnings.map((w,i)=><p className="small-note ai-chunk-warning" key={i}>{t(`ai_warning_${w.code}`)}</p>)}</div>)}</details>}
    <section className="ai-exports"><h3>{t('aiExport')}</h3><button className="primary full" onClick={()=>downloads.saveOne(files.find(f=>f.kind==='clean')!)}>{t('aiCleanDownload')}</button><details className="ai-export-details" open={showParts}><summary>{t('aiPackageDetails')}</summary><button className="secondary full" disabled={downloadState.phase==='requesting'} onClick={()=>void downloads.start(files.filter(f=>f.kind!=='clean'),()=>queue.getSnapshot().items.find(i=>i.id===job.id)?.result===result)}>{t('aiPackage')}</button>
      {downloadState.phase==='requesting'&&<button className="text-button" onClick={()=>downloads.stop()}>{t('aiStopDownloads')}</button>}
      <p className="information ai-download-note">{t('aiDownloadNote')}</p>
      {downloadState.phase==='error'?<p className="error" role="alert">{t('aiDownloadError')}</p>:downloadState.phase==='requests-sent'?<p role="status">{t('aiRequests',{count:downloadState.requestsSent})}</p>:null}
      <AiExportList files={files} downloads={downloads}/></details>
    </section>
  </div>;
}
