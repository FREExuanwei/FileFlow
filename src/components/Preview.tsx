import { useEffect, useMemo, useState } from 'react';
import type { ConversionResult } from '../core/conversion/types';
import { markdownToHtml, sanitizeHtml } from '../converters/markup/transform';
import { useI18n } from '../i18n/Provider';

const PREVIEW_LIMIT = 200000;
export function Preview({ result, truncated = false }: { result: ConversionResult; truncated?: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [imageUrl, setImageUrl] = useState('');
  const [appearance, setAppearance] = useState(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    const update = () => setAppearance(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => observer.disconnect();
  }, []);
  const isImage = !!result.dimensions;
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(result.blob); setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.blob, isImage]);
  const source = (result.text ?? '').slice(0, PREVIEW_LIMIT);
  const html = useMemo(() => {
    if (result.format !== 'md' && result.format !== 'html') return '';
    const clean = result.format === 'md' ? markdownToHtml(source) : sanitizeHtml(source);
    // Keep URLs in exports, but preview links are inert to prevent navigation.
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    doc.querySelectorAll('a').forEach(link => link.removeAttribute('href'));
    const dark = appearance === 'dark';
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>html{color-scheme:${appearance};background:${dark ? '#1a232e' : '#ffffff'};color:${dark ? '#e7edf5' : '#202938'}}body{font:15px/1.7 system-ui,sans-serif;padding:18px;overflow-wrap:anywhere}h1,h2,h3{line-height:1.3}h1{font-size:28px}pre{white-space:pre-wrap}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #888;padding:6px 12px}a{color:${dark ? '#b4a9f2' : '#5d4cbe'}}code{font-family:monospace}</style></head><body>${doc.body.innerHTML}</body></html>`;
  }, [result.format, source, appearance]);
  return <section className="preview-panel">
    <div className="preview-toolbar"><span>{t('previewHeading')}</span>{!isImage && <div className="segmented"><button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>{t('preview')}</button><button aria-pressed={mode === 'source'} onClick={() => setMode('source')}>{t('source')}</button></div>}</div>
    {isImage ? <div className="image-preview"><img src={imageUrl || undefined} alt={t('convertedAlt')} /></div> : mode === 'preview' && html ? <iframe title={t('safePreview')} sandbox="" srcDoc={html} referrerPolicy="no-referrer" /> : <pre className="source-preview">{source}</pre>}
    {(truncated || !!result.text && result.text.length > PREVIEW_LIMIT) && <p className="small-note">{t('truncated')}</p>}
  </section>;
}
