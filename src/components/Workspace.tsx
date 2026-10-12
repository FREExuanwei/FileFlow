import {nativeFileClick} from '../adapters/platform';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { ConversionQueue } from '../core/queue/store';
import { isFinished, isImage, type QueueItem, type QueueSnapshot } from '../core/queue/types';
import type { Format } from '../core/conversion/types';
import { recommendations } from '../core/queue/recommendations';
import { WebFileOutputAdapter } from '../adapters/web/files';
import { formatBytes } from '../utils/format';
import { Icon } from './Icon';
import { useI18n } from '../i18n/Provider';
import { formatLabel } from '../i18n/formats';
import { QueueSettings } from './QueueSettings';
import { QueueResult } from './QueueResult';

type Props = { queue: ConversionQueue; snapshot: QueueSnapshot; onFiles: (files: readonly File[]) => void; onClear: () => void; imageOnly?: boolean };
export function queueCategory(job?: QueueItem) { return job?.format ? recommendations(job.format)[0]?.category.toLowerCase() ?? 'document' : 'document'; }
export function Workspace({ queue, snapshot, onFiles, onClear, imageOnly = false }: Props) {
  const { t, language, message } = useI18n(), input = useRef<HTMLInputElement>(null), output = useRef(new WebFileOutputAdapter());
  const [tab, setTab] = useState<'settings' | 'results'>('settings'), [dragging, setDragging] = useState(false), [downloading, setDownloading] = useState(false);
  const dragDepth = useRef(0), downloadGeneration = useRef(0), heading = useRef<HTMLHeadingElement>(null);
  const restoreId = useRef<string | undefined>(undefined);
  const selected = snapshot.items.find(i => i.id === snapshot.activeId), completed = snapshot.items.filter(isFinished);
  const label = (format: Format) => formatLabel(language, format);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { const adapter = output.current; return () => { downloadGeneration.current++; adapter.dispose(); }; }, []);
  useEffect(() => { if (selected?.result) setTab('results'); else if (selected?.status === 'ready') setTab('settings'); }, [selected?.result?.blob, selected?.status]);
  function browse() { restoreId.current = undefined; input.current?.click(); }
  function browseAgain(id: string) { restoreId.current = id; input.current?.click(); }
  function remove(id: string) { if (snapshot.items.length === 1) onClear(); else queue.remove(id); }
  function clear() { downloadGeneration.current++; setDownloading(false); onClear(); }
  async function downloadAll() {
    if (downloading) return;
    const generation = ++downloadGeneration.current; setDownloading(true);
    for (const job of completed) {
      if (generation !== downloadGeneration.current) return;
      const current = queue.getSnapshot().items.find(i => i.id === job.id)?.result;
      if (current && current.blob === job.result?.blob) output.current.save(current.blob, job.result!.name);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (generation === downloadGeneration.current) setDownloading(false);
  }
  function drag(event: DragEvent, action: 'enter' | 'over' | 'leave' | 'drop') {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    if (action === 'enter') { dragDepth.current++; setDragging(true); }
    if (action === 'leave' && --dragDepth.current <= 0) setDragging(false);
    if (action === 'drop') { dragDepth.current = 0; setDragging(false); onFiles(Array.from(event.dataTransfer.files)); }
  }
  return <section className={`workspace workbench ${queueCategory(selected)} ${dragging ? 'dragging' : ''}`} aria-label={t('workbench')} onDragEnter={event => drag(event, 'enter')} onDragOver={event => drag(event, 'over')} onDragLeave={event => drag(event, 'leave')} onDrop={event => drag(event, 'drop')}>
    <div className="bench-toolbar"><div><h1 ref={heading} tabIndex={-1}>{t('workbench')}</h1><p>{t('queueCount', { count: snapshot.items.length })} <span>·</span> {t('completedCount', { done: completed.length, failed: snapshot.items.filter(i => i.status === 'failed').length })}</p></div><div className="bench-actions"><button className="secondary" onClick={browse}><Icon name="upload" size={16} />{t('addFiles')}</button><button className="primary" disabled={!snapshot.items.some(i => i.status === 'ready' && !i.issues?.name && !i.issues?.resize)} onClick={() => imageOnly ? snapshot.items.forEach(job => queue.start(job.id)) : queue.startAll()}><Icon name="flow" size={16} />{t('startAll')}</button><button className="secondary" disabled={!completed.length || downloading} onClick={() => void downloadAll()}><Icon name="download" size={16} />{t('downloadAll')}</button></div></div>
    <input ref={input} className="visually-hidden" type="file" onClick={event=>nativeFileClick(event,async files=>{const id=restoreId.current;restoreId.current=undefined;if(id&&files[0]){const file=files[0];await queue.restore(id,{name:file.name,size:file.size,type:file.type,blob:file});if(files.length>1)await onFiles(files.slice(1));}else await onFiles(files);})} multiple tabIndex={-1} aria-label={t('choose')} accept={imageOnly?'.png,.jpg,.jpeg,.webp':'.pdf,.docx,.md,.markdown,.html,.htm,.csv,.json,.png,.jpg,.jpeg,.webp'} onChange={event => { const files = Array.from(event.target.files ?? []), id = restoreId.current; restoreId.current = undefined; if (id && files[0]) { const file = files[0]; void queue.restore(id, { name: file.name, size: file.size, type: file.type, blob: file }); if (files.length > 1) onFiles(files.slice(1)); } else onFiles(files); event.target.value = ''; }} />
    {snapshot.notice && <div className="information" role="alert"><p>{message(snapshot.notice)}</p><button className="icon-button" aria-label={t('dismiss')} onClick={queue.dismissNotice}><Icon name="close" size={16} /></button></div>}
    <div className="bench-grid">
      <aside className="queue-panel" aria-label={t('queue')}><div className="panel-title"><h2>{t('queue')}</h2><span>{snapshot.items.length}</span></div>
        <div className="queue-list" role="list">{snapshot.items.map(job => <div role="listitem" className={`queue-row ${queueCategory(job)} ${job.id === selected?.id ? 'selected' : ''}`} key={job.id} data-status={job.status}>
          <button className="queue-select" aria-label={t('selectFile', { name: job.name })} aria-pressed={job.id === selected?.id} onClick={() => { queue.select(job.id); setTab(job.result ? 'results' : 'settings'); }}><span className="queue-file-icon"><Icon name={isImage(job.format) ? 'image' : 'file'} size={20} /></span><span className="queue-file-text"><strong title={job.name}>{job.name}</strong><span>{formatBytes(job.size)} {job.format && <>· <span className="queue-type-label">{label(job.format)}</span> → {label(job.target)}</>}</span><span className={`status status-${job.status}`}>{t(`state_${job.status}`)}</span></span></button>
          <button className="icon-button queue-remove" aria-label={t('removeFile', { name: job.name })} onClick={() => remove(job.id)}><Icon name="close" size={15} /></button>
          {job.status === 'processing' && <progress value={job.progress} max={1} aria-label={`${job.name}: ${t('progress')}`} />}
        </div>)}</div>
        {selected?.format && recommendations(selected.format).length > 1 && <div className="batch-target"><label className="field-label" htmlFor="batch-target">{t('batchOutput')}</label><select id="batch-target" value={selected.mode === 'convert' ? `${selected.format}-to-${selected.target}` : recommendations(selected.format)[0]!.id} onChange={event => queue.applyTarget(selected.format!, event.target.value.split('-to-')[1] as Format)}>{recommendations(selected.format).map(route => <option key={route.id} value={route.id}>{label(route.output)}</option>)}</select><p className="small-note">{t('applyOutput', { format: label(selected.format) })}</p></div>}
        <div className="queue-cleanup"><button className="text-button" disabled={!completed.length} onClick={() => completed.length === snapshot.items.length ? clear() : imageOnly ? completed.forEach(job => queue.remove(job.id)) : queue.clearCompleted()}>{t('clearCompleted')}</button><button className="text-button" onClick={clear}>{t('clearAll')}</button></div><p className="small-note session-note"><Icon name="lock" size={13} />{t('sessionOnly')}</p>
      </aside>
      <div className="mobile-panels" role="tablist" aria-label={t('workbench')}>{(['settings', 'results'] as const).map(value => <button key={value} id={`${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`${value}-panel`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'settings' : event.key === 'End' ? 'results' : tab === 'settings' ? 'results' : 'settings'; setTab(next); document.getElementById(`${next}-tab`)?.focus(); } }}>{t(value)}</button>)}</div>
      <div id="settings-panel" className={`settings-panel ${tab === 'settings' ? 'mobile-active' : ''}`} role="tabpanel" aria-labelledby="settings-tab"><h2 id="settings-title" className="panel-title">{t('settings')}</h2>{selected ? <QueueSettings key={`${selected.id}-${selected.format}`} job={selected} queue={queue} browse={() => browseAgain(selected.id)} remove={() => remove(selected.id)} /> : <p>{t('noSelection')}</p>}</div>
      <div id="results-panel" data-state={selected?.status} className={`result-column ${tab === 'results' ? 'mobile-active' : ''}`} role="tabpanel" aria-labelledby="results-tab"><h2 id="results-title" className="panel-title">{t('results')}</h2>{selected?.result ? <QueueResult key={selected.id} job={selected} visible={tab === 'results'} save={(result) => output.current.save(result.blob, result.name)} browse={() => browseAgain(selected.id)} /> : <div className="empty-output"><Icon name="file" size={35} /><h2>{t('emptyTitle')}</h2><p>{selected?.status === 'processing' ? t('converting', { percent: Math.round(selected.progress * 100) }) : t('emptyDescription')}</p></div>}</div>
    </div>
    <div className="bench-footnote"><span>{t('limitsQueue')}</span><span>{t('concurrency')}</span>{completed.length > 1 && <span>{t('downloadHint')}</span>}</div>
    {dragging && <div className="bench-drop-overlay" role="status"><Icon name="upload" size={32} />{t('release')}</div>}
  </section>;
}
