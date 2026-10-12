import {nativeFileClick} from '../adapters/platform';
import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/Provider';
import {fileEnvironment} from '../core/files/policy';

export function Dropzone({ onFiles, focusOnMount = false, imageOnly = false }: { onFiles: (files: readonly File[]) => void; focusOnMount?: boolean; imageOnly?: boolean }) {
  const { t,language } = useI18n();
  const desktop=fileEnvironment()==='desktop';
  const sizeHint=desktop?(language==='zh-CN'?'Windows：PDF / 图片最大 100 MiB；其他格式按各工具限制':'Windows: PDF / images up to 100 MiB; other formats follow tool limits'):t('sizeHint');
  const input = useRef<HTMLInputElement>(null), [dragging, setDragging] = useState(false), depth = useRef(0);
  return <section className={`dropzone ${dragging ? 'dragging' : ''}`} aria-label={t('import')}
    onDragEnter={event => { event.preventDefault(); depth.current++; setDragging(true); }}
    onDragOver={event => event.preventDefault()}
    onDragLeave={event => { event.preventDefault(); if (--depth.current <= 0) setDragging(false); }}
    onDrop={event => { event.preventDefault(); depth.current = 0; setDragging(false); onFiles(Array.from(event.dataTransfer.files)); }}>
    <div className="drop-art" aria-hidden="true"><span className="mini-document back"><Icon name="image" size={27} /></span><span className="mini-document front"><Icon name="file" size={34} /></span><span className="upload-bubble"><Icon name="upload" size={21} /></span></div>
    <h2 aria-live="polite">{t(dragging ? 'release' : 'drop')}</h2><p>{t('dropDescription')}</p>
    <button className="primary" autoFocus={focusOnMount} onClick={() => input.current?.click()}><Icon name="upload" size={18} />{t('browse')}</button>
    <input ref={input} className="visually-hidden" type="file" onClick={event=>nativeFileClick(event,onFiles)} multiple tabIndex={-1} aria-label={t('choose')} accept={imageOnly?'.png,.jpg,.jpeg,.webp':'.pdf,.docx,.md,.markdown,.html,.htm,.csv,.tsv,.json,.yaml,.yml,.xlsx,.png,.jpg,.jpeg,.webp'} onChange={event => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    <span className="drop-hint">{imageOnly?'PNG / JPEG / WebP':t('supported')}<span>{sizeHint}</span></span>
  </section>;
}

