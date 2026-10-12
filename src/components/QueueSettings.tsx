import type { ConversionQueue } from '../core/queue/store';
import { isBusy, isImage, type QueueItem } from '../core/queue/types';
import type { Format } from '../core/conversion/types';
import { recommendations } from '../core/queue/recommendations';
import { formats } from '../core/files/detect';
import { formatBytes } from '../utils/format';
import { Icon } from './Icon';
import { useI18n } from '../i18n/Provider';
import { formatLabel } from '../i18n/formats';
import type {P5Format} from '../core/phase5/types';
const ext = (format: Format) => format === 'jpeg' ? 'jpg' : format;
export function QueueSettings({ job, queue, browse, remove,extraRoutes=[],onRoute }: { job: QueueItem; queue: ConversionQueue; browse: () => void; remove: () => void;extraRoutes?:readonly{id:string;output:P5Format;outputExtension:string}[];onRoute?:(id:string)=>void }) {
  const { t, language, message } = useI18n();
  const name = job.draftName ?? job.basename, nameError = job.issues?.name;
  const width = job.draftResize?.width ?? String(job.options.resize?.width ?? job.sourceDimensions?.width ?? ''), height = job.draftResize?.height ?? String(job.options.resize?.height ?? job.sourceDimensions?.height ?? ''), resizeError = job.issues?.resize;
  const routes = job.format ? recommendations(job.format) : [], route = routes.find(i => i.output === job.target), busy = isBusy(job), editable = !!job.input && !busy;
  const label = (format: Format) => formatLabel(language, format), keepAspect = job.options.resize?.keepAspect ?? true;
  const disabled = !editable;
  function resize(axis: 'width' | 'height', value: string, ratio = keepAspect) {
    queue.editResize(job.id, axis === 'width' ? value : width, axis === 'height' ? value : height, ratio, axis);
  }
  function resetDimensions() { if (job.sourceDimensions) queue.editResize(job.id, String(job.sourceDimensions.width), String(job.sourceDimensions.height), keepAspect, 'width'); }
  return <>
    <div className="file-summary"><span className="format-icon"><Icon name={isImage(job.format) ? 'image' : 'file'} size={23} /></span><div><h2 title={job.name}>{job.name}</h2><p><span className={job.format ? 'file-type-label' : undefined}>{job.format ? label(job.format) : t('unsupportedTarget')}</span> · {formatBytes(job.size)}</p></div></div>
    {job.format && job.size > formats[job.format].limit * 1024 ** 2 / 2 && <p className="notice">{t('large')}</p>}
    {routes.length > 0 && <>
      {isImage(job.format) && <div className="segmented tool-switch" aria-label={t('imageTools')}><button disabled={disabled} aria-pressed={job.mode === 'convert'} onClick={() => queue.configure(job.id, { mode: 'convert', target: routes[0]!.output, options: { quality: job.options.quality } })}>{t('conversionMode')}</button><button disabled={disabled} aria-pressed={job.mode === 'image'} onClick={() => { queue.configure(job.id, { mode: 'image', target: job.target, options: { ...job.options, resize: { ...job.sourceDimensions!, keepAspect } } }); resetDimensions(); }}>{t('imageTools')}</button></div>}
      <label className="field-label" htmlFor="target">{t('convertTo')}</label><select id="target" value={job.mode === 'convert' ? `${job.format}-to-${job.target}` : job.target} disabled={disabled} onChange={event => {if(job.mode==='convert'&&extraRoutes.some(r=>r.id===event.target.value)){onRoute?.(event.target.value);return;}queue.configure(job.id, { target: (job.mode === 'convert' ? event.target.value.split('-to-')[1] : event.target.value) as Format });}}>{job.mode === 'convert' ? [...routes.map(converter => <option value={converter.id} key={converter.id}>{label(converter.output)} (.{converter.outputExtension})</option>),...extraRoutes.map(route=><option value={route.id} key={route.id}>{route.output.toUpperCase()} (.{route.outputExtension})</option>)] : (['png', 'jpeg', 'webp'] as const).map(format => <option key={format} value={format}>{label(format)} (.{ext(format)})</option>)}</select>
      {job.mode === 'convert' && <div className="smart-recommendation"><span><Icon name="info" size={14} />{t('smart')} · {label(routes[0]!.output)}</span><p>{t(['pdf', 'docx'].includes(job.format!) ? 'recommendText' : ['png', 'jpeg'].includes(job.format!) ? 'recommendImage' : 'recommendRoute')}</p>{job.target !== routes[0]!.output && <button className="text-button" disabled={disabled} onClick={() => queue.configure(job.id, { target: routes[0]!.output })}>{t('useRecommended')}</button>}</div>}
      {job.mode === 'image' && <div className="resize-fields"><div><label htmlFor="image-width">{t('width')}</label><input id="image-width" type="number" min={1} max={16384} step={1} disabled={disabled} value={width} aria-invalid={!!resizeError} onChange={event => resize('width', event.target.value)} /></div><div><label htmlFor="image-height">{t('height')}</label><input id="image-height" type="number" min={1} max={16384} step={1} disabled={disabled} value={height} aria-invalid={!!resizeError} onChange={event => resize('height', event.target.value)} /></div><label className="checkbox-label"><input type="checkbox" checked={keepAspect} disabled={disabled} onChange={event => resize('width', width, event.target.checked)} />{t('keepAspect')}</label><button className="text-button" disabled={disabled} onClick={resetDimensions}>{t('resetDimensions')}</button><p className="small-note">{t('resizeLimits')}</p>{resizeError && <p className="error" role="alert">{message(resizeError)}</p>}</div>}
      {isImage(job.format) && job.target !== 'png' && <div className="quality"><label htmlFor="quality">{t('quality')} <strong>{Math.round((job.options.quality ?? .85) * 100)}%</strong></label><input id="quality" type="range" min="10" max="100" value={Math.round((job.options.quality ?? .85) * 100)} disabled={disabled} onChange={event => queue.configure(job.id, { options: { ...job.options, quality: Number(event.target.value) / 100 } })} /><p>{t('smaller')} <span>{t('higher')}</span></p></div>}
      <label className="field-label" htmlFor="output-name">{t('outputName')}</label><div className="filename-field"><input id="output-name" value={name} disabled={busy} maxLength={120} aria-invalid={!!nameError} aria-describedby="name-hint" onChange={event => { queue.editName(job.id, event.target.value); }} /><span>.{ext(job.target)}</span></div><p id="name-hint" className="small-note">{t('nameHint')}</p>{nameError && <p className="error" role="alert">{message(nameError)}</p>}
      {job.mode === 'convert' && route && <><p className="description">{message(route.description)}</p><details className="limitations" open={!isImage(job.format)}><summary>{t('goodToKnow')}</summary>{route.limitations.map(limit => <p key={limit}>{message(limit)}</p>)}</details></>}
      {job.mode === 'image' && <p className="small-note">{t('imageToolsNote')}</p>}
    </>}
    {['processing', 'queued'].includes(job.status) ? <div className="progress-area"><p role="status">{t('converting', { percent: Math.round(job.progress * 100) })}</p><progress value={job.progress} max="1" aria-label={t('progress')} /><button className="secondary full" onClick={() => queue.cancel(job.id)}>{t('cancel')}</button></div> : job.input && job.format ? <button className="primary full" disabled={busy || !!nameError || !!resizeError} onClick={() => queue.start(job.id)}><Icon name="flow" size={18} />{t(job.status === 'failed' || job.status === 'cancelled' ? 'retry' : 'convert')}</button> : !busy && <><p className="small-note">{job.result ? t('sourceReleased') : t('importingFiles')}</p><button className="secondary full" onClick={browse}>{t('chooseAgain')}</button></>}
    {job.error && <div className="error" role="alert"><strong>{t('error')}</strong><p>{message(job.error)}</p></div>}
    {job.status === 'cancelled' && <p className="information" role="status">{t('cancelledNotice')}</p>}
    <div className="settings-bottom"><span className="small-note"><Icon name="shield" size={14} />{t('inlinePrivacy')}</span><button className="text-button" onClick={remove}>{t('clear')}</button></div>
  </>;
}
