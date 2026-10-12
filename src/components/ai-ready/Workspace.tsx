import {nativeFileClick} from '../../adapters/platform';
import { useRef,useState,type DragEvent } from 'react';
import type { AiReadyQueue,AiSnapshot } from '../../core/ai-ready/queue';
import { useI18n } from '../../i18n/Provider';
import { AiQueue,aiCategory } from './Queue';
import { AiSettingsPanel } from './Settings';
import { Icon } from '../Icon';
import { AiResults } from './Results';
export function AiWorkspace({queue,snapshot,onFiles}:{queue:AiReadyQueue;snapshot:AiSnapshot;onFiles:(files:readonly File[])=>void}){
  const {t}=useI18n(),input=useRef<HTMLInputElement>(null),[tab,setTab]=useState<'settings'|'results'>('settings');const job=snapshot.items.find(j=>j.id===snapshot.activeId);
  function drop(e:DragEvent){if(e.dataTransfer.types.includes('Files')){e.preventDefault();onFiles(Array.from(e.dataTransfer.files));}}
  return <section className={`workspace workbench ai-workspace ${aiCategory(job)}`} aria-label={t('aiMode')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={drop}>
    <div className="bench-toolbar"><div><h1>{t('aiMode')}</h1><p>{t('aiSubtitle')}</p></div><div className="bench-actions"><button className="secondary" onClick={()=>input.current?.click()}><Icon name="upload" size={16}/>{t('addFiles')}</button><button className="primary" disabled={!snapshot.items.some(j=>j.status==='ready')} onClick={queue.startAll}>{t('aiProcessAll')}</button></div></div>
    <input ref={input} className="visually-hidden" type="file" onClick={event=>nativeFileClick(event,onFiles)} tabIndex={-1} multiple aria-label={t('choose')} accept=".pdf,.docx,.md,.markdown,.html,.htm,.txt" onChange={e=>{onFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
    <p className="information ai-privacy"><Icon name="shield" size={16}/>{t('aiPrivacy')}</p>
    {snapshot.notice&&<p className="error" role="alert">{t(`ai_error_${snapshot.notice}`)} <button className="text-button" onClick={queue.dismissNotice}>{t('dismiss')}</button></p>}
    {!snapshot.items.length?<div className="ai-empty"><Icon name="file" size={35}/><h2>{t('aiTitle')}</h2><p>{t('aiSupported')}</p><button className="primary" onClick={()=>input.current?.click()}>{t('browse')}</button></div>:<div className="bench-grid">
      <AiQueue queue={queue} snapshot={snapshot}/>
      <div className="mobile-panels" role="tablist" aria-label={t('aiMode')}>{(['settings','results'] as const).map(value=><button key={value} id={`ai-${value}-tab`} role="tab" aria-controls={`ai-${value}-panel`} aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>setTab(value)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'settings':e.key==='End'?'results':tab==='settings'?'results':'settings';setTab(next);document.getElementById(`ai-${next}-tab`)?.focus();}}}>{t(value)}</button>)}</div>
      <div id="ai-settings-panel" role="tabpanel" aria-labelledby="ai-settings-tab" className={`settings-panel ${tab==='settings'?'mobile-active':''}`}><h2 className="panel-title">{t('settings')}</h2>{job&&<AiSettingsPanel job={job} queue={queue}/>}</div>
      <div id="ai-results-panel" role="tabpanel" aria-labelledby="ai-results-tab" data-state={job?.status} className={`result-column ${tab==='results'?'mobile-active':''}`}><h2 className="panel-title">{t('results')}</h2>{job?.stage&&<p role="status" className="ai-stage">{t(`aiStage_${job.stage}`)}</p>}{job?.result?<AiResults key={job.id} job={job} queue={queue}/>:<div className="empty-output"><Icon name="file" size={35}/><p>{t('aiEmpty')}</p></div>}</div>
    </div>}
    <p className="small-note ai-estimate-note">{t('aiEstimateNote')}</p>
  </section>;
}
