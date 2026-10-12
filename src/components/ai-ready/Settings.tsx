import type { AiJob,AiReadyQueue } from '../../core/ai-ready/queue';
import { settingsForPreset } from '../../core/ai-ready/defaults';
import type { AiSettings,Preset } from '../../core/ai-ready/types';
import { useI18n } from '../../i18n/Provider';
import {AiAssessment} from './Assessment';
const options=['mergeLines','removeHeaders','removeFooters','removePageNumbers','collapseBlankLines','normalizeHeadings','normalizeLists'] as const;
export function AiSettingsPanel({job,queue}:{job:AiJob;queue:AiReadyQueue}){
  const {t}=useI18n(),settings=job.settings,busy=['processing','queued','validating'].includes(job.status);
  const update=(value:AiSettings)=>queue.configure(job.id,value);
  return <div className="ai-settings"><div className="file-summary"><strong>{job.name}</strong><span className="file-type-label">{job.format?.toUpperCase()}</span></div>
    <AiAssessment job={job}/>
    <details className="ai-advanced"><summary>{t('aiAdvanced')}</summary>
    <label className="field-label" htmlFor="ai-preset">{t('aiPreset')}</label><select id="ai-preset" value={settings.preset} disabled={busy} onChange={e=>{const preset=settingsForPreset(e.target.value as Preset);update({...preset,chunking:settings.chunking});}}><option value="conservative">{t('aiConservative')}</option><option value="balanced">{t('aiBalanced')}</option><option value="aggressive">{t('aiAggressive')}</option></select>
    <p className="small-note">{t('aiKeepBody')}</p>{settings.preset==='aggressive'&&<p className="warning ai-aggressive">{t('aiAggressiveNote')}</p>}
    <fieldset className="ai-options" disabled={busy}><legend>{t('aiOptions')}</legend>{options.map(key=><label className="checkbox-label" key={key}><input id={`ai-${key}`} type="checkbox" checked={settings.cleanup[key]} onChange={e=>update({...settings,cleanup:{...settings.cleanup,[key]:e.target.checked}})}/>{t(`ai_${key}`)}</label>)}</fieldset>
    {options.some(key=>settings.cleanup[key]!==settingsForPreset(settings.preset).cleanup[key])&&<p className="small-note">{t('aiCustom')}</p>}
    {!!job.result?.cleaned.candidates.length&&<details className="ai-candidates"><summary>{t('aiCandidates')} ({job.result.cleaned.candidates.length})</summary>{job.result.cleaned.candidates.map(c=><div key={c.id}><strong>{c.text}</strong><p className="small-note">{t(c.kind==='header'?'aiHeader':'aiFooter')} · {t('aiOccurrences',{count:c.occurrences.length})} · {t(c.confidence==='high'?'aiHigh':'aiAmbiguous')} · {t(c.removed?'aiRemoved':'aiKept')}</p><select aria-label={`${t('aiCandidates')}: ${c.text}`} disabled={busy} value={settings.cleanup.candidateOverrides[c.id]??'auto'} onChange={e=>{const overrides={...settings.cleanup.candidateOverrides};if(e.target.value==='auto')delete overrides[c.id];else overrides[c.id]=e.target.value as 'keep'|'remove';update({...settings,cleanup:{...settings.cleanup,candidateOverrides:overrides}});}}><option value="auto">{t('aiAuto')}</option><option value="keep">{t('aiKeep')}</option><option value="remove">{t('aiRemove')}</option></select></div>)}</details>}
    <label className="field-label" htmlFor="ai-strategy">{t('aiStrategy')}</label><select id="ai-strategy" disabled={busy} value={settings.chunking.strategy} onChange={e=>update({...settings,chunking:{...settings.chunking,strategy:e.target.value as AiSettings['chunking']['strategy']}})}><option value="auto">{t('aiChunkAuto')}</option><option value="headings">{t('aiHeadings')}</option><option value="tokens">{t('aiTokens')}</option></select>
    <label className="field-label" htmlFor="ai-target">{t('aiTarget')}</label><select id="ai-target" value={settings.chunking.targetEstimatedTokens} disabled={busy||settings.chunking.strategy==='auto'} onChange={e=>update({...settings,chunking:{...settings.chunking,targetEstimatedTokens:Number(e.target.value) as 2000|4000|8000|16000}})}>{[2000,4000,8000,16000].map(n=><option key={n} value={n}>{t('aiEstimated',{count:n.toLocaleString()})}</option>)}</select>
    <label className="field-label" htmlFor="ai-overlap">{t('aiOverlap')}</label><select id="ai-overlap" value={settings.chunking.overlapPercent} disabled={busy||settings.chunking.strategy==='auto'} onChange={e=>update({...settings,chunking:{...settings.chunking,overlapPercent:Number(e.target.value) as 0|5|10}})}>{[0,5,10].map(n=><option key={n} value={n}>{n}%</option>)}</select><p className="small-note">{t('aiOverlapNote')}</p>
    </details>
    {busy?<button className="secondary full" onClick={()=>queue.cancel(job.id)}>{t('cancel')}</button>:<button className="primary full ai-process" disabled={!job.format||(!job.input&&!job.result)} onClick={()=>queue.start(job.id)}>{t(job.result?'aiReprocess':'aiProcess')}</button>}
    {job.error&&<p className="error" role="alert">{t(`ai_error_${job.error}`)}</p>}{job.status==='cancelled'&&<p className="information">{t('ai_error_cancelled')}</p>}
  </div>;
}
