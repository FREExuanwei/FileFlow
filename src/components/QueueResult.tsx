import { useEffect, useRef, useState } from 'react';
import type { QueueItem } from '../core/queue/types';
import type { ConversionResult } from '../core/conversion/types';
import { formatBytes } from '../utils/format';
import { Preview } from './Preview';
import { Icon } from './Icon';
import { useI18n } from '../i18n/Provider';
import { formatLabel } from '../i18n/formats';
export function QueueResult({ job, save, browse, visible }: { job: QueueItem; save: (result: ConversionResult) => void; browse: () => void; visible: boolean }) {
  const { t, language, message } = useI18n(), result = job.result!;
  const [showPreview, setShowPreview] = useState(true), [preview, setPreview] = useState<{ blob: Blob; text: string; truncated: boolean }>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (visible) heading.current?.focus(); }, [result.blob, visible]);
  useEffect(() => {
    let active = true;
    if (showPreview && !result.dimensions) void result.blob.slice(0, 800004).text().then(text => { if (active) setPreview({ blob: result.blob, text: text.slice(0, 200000), truncated: text.length > 200000 || result.blob.size > 800004 }); });
    return () => { active = false; };
  }, [result.blob, result.dimensions, showPreview]);
  const difference = result.blob.size - job.size, percent = Math.abs(difference / job.size * 100).toFixed(1);
  return <><div className={`result-summary ${result.warnings.length ? 'has-warning' : ''}`}><div className="success-header" role="status"><span className="success-icon"><Icon name={result.warnings.length ? 'alert' : 'check'} size={17} /></span>{t('ready')}</div><h2 ref={heading} tabIndex={-1}>{result.name}</h2><div className="result-stats"><div><span>{t('outputFormat')}</span><strong className="result-format-label" data-format={result.format}>{formatLabel(language, result.format)}</strong></div><div><span>{t('originalSize')}</span><strong>{formatBytes(job.size)}</strong></div><div><span>{t('outputSize')}</span><strong>{formatBytes(result.blob.size)}</strong></div></div><p className={`size-comparison ${difference > 0 ? 'larger' : difference < 0 ? 'smaller' : ''}`}>{difference ? t(difference > 0 ? 'increasedBy' : 'reducedBy', { percent }) : t('equalSize')}</p>
      {result.dimensions && <p className="dimensions">{t('originalDimensions')}: {result.originalDimensions?.width ?? job.sourceDimensions?.width} × {result.originalDimensions?.height ?? job.sourceDimensions?.height}<br />{t('outputDimensions')}: <strong>{result.dimensions.width} × {result.dimensions.height}</strong></p>}{result.pages && <p className="small-note">{t('pages', { count: result.pages })}</p>}
      <div className="result-actions"><button className="download-button" onClick={() => save(result)}><Icon name="download" size={18} />{t('download')}</button><button className="secondary" onClick={browse}><Icon name="flow" size={16} />{t('again')}</button></div>{result.warnings.map(warning => <p className="notice" key={warning}>{message(warning, 'warning')}</p>)}</div>
      <button className="text-button preview-toggle" aria-expanded={showPreview} onClick={() => setShowPreview(!showPreview)}>{t(showPreview ? 'hidePreview' : 'showPreview')}</button>
      {showPreview && (result.dimensions ? <Preview key={job.id} result={result} /> : preview?.blob === result.blob ? <Preview key={job.id} result={{ ...result, text: preview.text }} truncated={preview.truncated} /> : <p role="status">{t('previewLoading')}</p>)}
    </>;
}
