import type {AiJob} from '../../core/ai-ready/queue';
import {recommendDocument,AUTO_CHUNK_THRESHOLD} from '../../core/ai-ready/recommendation';
import {useI18n} from '../../i18n/Provider';
import {formatBytes} from '../../utils/format';
export function AiAssessment({job}:{job:AiJob}){
  const {t,language}=useI18n(),recommendation=job.result?recommendDocument(job.result):undefined;
  return <div className="ai-assessment"><dl><div><dt>{t('aiDocumentSize')}</dt><dd>{formatBytes(job.size)}{job.result&&<span>{t('aiEstimated',{count:job.result.before.estimatedTokens.toLocaleString(language)})}</span>}</dd></div><div><dt>{t('aiDocumentState')}</dt><dd>{recommendation?t(recommendation.alreadyClean?'aiStateClean':recommendation.kind==='clean'||recommendation.kind==='clean-and-chunk'?'aiStateCleanup':'aiStateReview'):t('aiStateUnchecked')}</dd></div></dl><p className="small-note">{t(job.result?'aiAutoNote':'aiCheckNote',{count:AUTO_CHUNK_THRESHOLD.toLocaleString(language)})}</p></div>;
}
