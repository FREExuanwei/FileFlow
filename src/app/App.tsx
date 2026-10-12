import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQueue } from '../hooks/useQueue';
import { useTheme } from '../hooks/useTheme';
import { Dropzone } from '../components/Dropzone';
import { Workspace } from '../components/Workspace';
import { Icon } from '../components/Icon';
import {activeCatalog,PRODUCT_ADMISSION} from '../core/phase5/catalog';
import { formatLabel } from '../i18n/formats';
import { useI18n } from '../i18n/Provider';
import type { Language } from '../i18n';
import { WebFileInputAdapter } from '../adapters/web/files';
import { ResourceBudget } from '../core/resources/budget';
import { ExecutionGate } from '../core/resources/execution';
import {getDesktopPlatform} from '../adapters/platform';
import {DesktopPrivacy} from '../desktop/Privacy';
import { useAiReady } from '../hooks/useAiReady';
import { AiWorkspace } from '../components/ai-ready/Workspace';
import { WorkspaceModes } from '../components/WorkspaceModes';
import { isImage } from '../core/queue/types';
import {usePhase5} from '../hooks/usePhase5';
import {useOcr} from '../hooks/useOcr';
import {usePdfTools} from '../hooks/usePdfTools';
import {toP5Input} from '../adapters/web/phase5-input';
import {errorCode} from '../core/phase5/errors';
import type {P5Format} from '../core/phase5/types';
import '../styles/phase5.css';
const converters=activeCatalog(PRODUCT_ADMISSION).map(r=>r.converter);
const Phase5Workspace=lazy(()=>import('../components/phase5/Workspace').then(module=>({default:module.Phase5Workspace})));
const UtilityImport=lazy(()=>import('../components/phase5/Utilities').then(module=>({default:module.UtilityImport})));
const Phase5ImportError=lazy(()=>import('../components/phase5/Utilities').then(module=>({default:module.Phase5ImportError})));
const OcrWorkspace=lazy(()=>import('../components/ocr/Workspace').then(module=>({default:module.OcrWorkspace})));
const PdfToolsWorkspace=lazy(()=>import('../components/pdf-tools/Workspace').then(module=>({default:module.PdfToolsWorkspace})));

const categories = [
  { id: 'Document', title: 'documents', icon: 'file', accent: 'document', description: 'documentsDescription' },
  { id: 'Image', title: 'images', icon: 'image', accent: 'image', description: 'imagesDescription' },
  { id: 'Data', title: 'data', icon: 'data', accent: 'data', description: 'dataDescription' },
  { id: 'Markup', title: 'markup', icon: 'code', accent: 'markup', description: 'markupDescription' },
] as const;

export default function App() {
  const [resources] = useState(()=>getDesktopPlatform()?.resources??({budget:new ResourceBudget(),execution:new ExecutionGate()}));
  const { queue, snapshot } = useQueue(resources), ai = useAiReady(resources), theme = useTheme(), { t, language, setLanguage } = useI18n();
  const phase5=usePhase5(queue,resources),[importError,setImportError]=useState<string>();
  const routeLabel=(format:P5Format)=>format==='tsv'||format==='yaml'||format==='xlsx'?format.toUpperCase():formatLabel(language,format);
  const ocr=useOcr(resources),pdfTools=usePdfTools(resources);
  const [toolsRequest,setToolsRequest]=useState(0);
  const [mode,setMode] = useState<'convert'|'ai-ready'|'image'|'ocr'|'pdf-tools'>('convert');
  const images = snapshot.items.filter(job=>isImage(job.format));
  const visibleSnapshot = mode==='image' ? {...snapshot,items:images,activeId:images.some(job=>job.id===snapshot.activeId)?snapshot.activeId:images[0]?.id} : snapshot;
  function activateImages() { for(const job of queue.getSnapshot().items)if(isImage(job.format)&&job.status==='ready'&&job.mode!=='image')queue.configure(job.id,{mode:'image',target:job.target});const first=queue.getSnapshot().items.find(job=>isImage(job.format));if(first)queue.select(first.id); }
  const importFiles = async (files: readonly File[]) => {setImportError(undefined);if(mode==='image')await queue.add(new WebFileInputAdapter().readMany(files)).then(activateImages);else await phase5.coordinator.add(files.map(toP5Input)).catch(error=>setImportError(errorCode(error)));};
  useEffect(()=>getDesktopPlatform()?.importer(mode==='pdf-tools'?files=>pdfTools.store.add(new WebFileInputAdapter().readMany(files)):mode==='ocr'?files=>ocr.queue.add(new WebFileInputAdapter().readMany(files)):mode==='ai-ready'?async files=>{await ai.queue.add(new WebFileInputAdapter().readMany(files));}:importFiles));
  function changeMode(next:typeof mode){setView('main');setMode(next);if(next==='image')activateImages();}
  const [showPrivacy, setShowPrivacy] = useState(false), [view, setView] = useState('main');
  const focusImport = useRef(false);
  function clearTask() { focusImport.current = true;if(mode==='image')images.forEach(job=>queue.remove(job.id));else phase5.coordinator.clear(); }
  useEffect(() => {
    const update = () => setView(location.hash === '#formats' ? 'formats' : 'main');
    update(); window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return <div className="app-shell">
    <a className="skip-link" href="#main">{t('skip')}</a>
    <header className="site-header">
      <a className="brand" href="#main" aria-label={t('home')}><span className="brand-symbol"><Icon name="flow" size={24} /></span>FileFlow<span className="web-badge">{getDesktopPlatform()?'DESKTOP':'WEB'}</span></a>
      <nav aria-label={t('nav')}><a href="#main" className={view === 'main' ? 'active' : ''} aria-current={view === 'main' ? 'location' : undefined}>{t('converter')}</a><a href="#formats" className={view === 'formats' ? 'active' : ''} aria-current={view === 'formats' ? 'location' : undefined}>{t('formats')}</a><button className="nav-button" onClick={() => setShowPrivacy(true)}>{t('privacy')}</button></nav>
      <div className="header-end"><span className="device-badge"><span />{t('device')}</span><label className="setting-picker language-picker"><Icon name="globe" size={17} /><select aria-label={t('language')} value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="zh-CN" lang="zh-CN">简体中文</option><option value="en" lang="en">English</option></select></label><label className="setting-picker theme-picker"><Icon name={theme.theme === 'dark' ? 'moon' : theme.theme === 'system' ? 'device' : 'sun'} size={17} /><select aria-label={t('theme')} value={theme.theme} onChange={event => theme.setTheme(event.target.value as 'light' | 'dark' | 'system')}><option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option></select></label></div>
    </header>
    <main id="main">
      {view === 'main' && <WorkspaceModes mode={mode} onModeChange={changeMode} onTools={()=>{changeMode('convert');setToolsRequest(n=>n+1);}}/>}
      {view==='main'&&mode==='convert'&&<Suspense fallback={null}><UtilityImport coordinator={phase5.coordinator} openRequest={toolsRequest}/></Suspense>}
      {view==='main'&&mode==='convert'&&importError&&<Suspense fallback={null}><Phase5ImportError code={importError}/></Suspense>}
      {view === 'main' && mode === 'ai-ready' && <AiWorkspace queue={ai.queue} snapshot={ai.snapshot} onFiles={async files=>{await ai.queue.add(new WebFileInputAdapter().readMany(files));}}/>}
      {view==='main'&&mode==='pdf-tools'&&<Suspense fallback={<p role="status">{t('importingFiles')}</p>}><PdfToolsWorkspace store={pdfTools.store} snapshot={pdfTools.snapshot} resources={resources}/></Suspense>}
      {view==='main'&&mode==='ocr'&&getDesktopPlatform()&&<Suspense fallback={<p role="status">{t('importingFiles')}</p>}><OcrWorkspace queue={ocr.queue} snapshot={ocr.snapshot}/></Suspense>}
      {view === 'main' && mode !== 'ai-ready' && mode!=='ocr' && mode!=='pdf-tools' && ((mode==='convert'?phase5.snapshot.items.length:visibleSnapshot.items.length) ? mode==='convert'?<Suspense fallback={<p role="status">{t('importingFiles')}</p>}><Phase5Workspace coordinator={phase5.coordinator} snapshot={phase5.snapshot} onFiles={importFiles} onClear={clearTask} inspect={phase5.inspectWorkbook}/></Suspense>:<Workspace queue={queue} snapshot={visibleSnapshot} onFiles={importFiles} onClear={clearTask} imageOnly /> : <section className="hero">
        <div className="hero-decoration" aria-hidden="true"><span className="format-chip document chip-one"><Icon name="file" size={15} />PDF</span><span className="format-chip markup chip-two"><Icon name="code" size={15} />MD</span><span className="format-chip image chip-three"><Icon name="image" size={15} />PNG</span><span className="format-chip data chip-four"><Icon name="data" size={15} />JSON</span></div>
        <div className="pill hero-pill"><Icon name="shield" size={14} />{t('heroBadge')}</div><h1>{t('heroTitle')}<span>{t('heroAccent')}</span></h1><p className="hero-description">{t('heroDescription')}</p>
        <Dropzone onFiles={importFiles} focusOnMount={focusImport.current} imageOnly={mode==='image'} />
        <div className="privacy-line"><Icon name="lock" size={15} /><span>{t('stays')}</span><span className="privacy-divider" /><span>{t('noUploadAccount')}</span></div>
        {mode==='convert'&&<button className="demo-button" onClick={() => importFiles([new File(['name,score\nAlice,95\nBob,88\n'], 'fileflow-demo.csv', { type: 'text/csv' })])}>{t('explore')} <span>{t('sample')} <Icon name="arrow" size={14} /></span></button>}
      </section>)}
      {(view === 'formats' || mode === 'convert' && !phase5.snapshot.items.length) && <section className="formats-section" id="formats"><div className="section-header"><div><span className="eyebrow">{t('formatEyebrow')}</span><h2>{t('formatTitle')}</h2></div><span className="small-note format-count">{t('formatNote')}</span></div>
        <div className="format-cards">{categories.map(category => {
          const routes = converters.filter(converter => converter.category === category.id);
          const inputs = [...new Set(routes.map(route => route.input))];
          return <article className={`format-card ${category.accent}`} key={category.id}>
            <div className="format-card-top"><span className="category-icon"><Icon name={category.icon} size={23} /></span><span className="route-count">{t('routes', { count: routes.length })}</span></div>
            <h3>{t(category.title)}</h3><p>{t(category.description)}</p>
            <div className="format-list">{inputs.filter(input=>!['tsv','yaml','xlsx'].includes(input)).map(input => <div className="format-route" key={input}><strong>{routeLabel(input)}</strong><Icon name="arrow" size={14} /><span>{routes.filter(route => route.input === input).map(route => route.output === 'txt' ? 'TXT' : routeLabel(route.output)).join(' / ')}</span></div>)}</div>
            {inputs.some(input=>['tsv','yaml','xlsx'].includes(input))&&<div className="p5-format-group"><p className="small-note">{language==='zh-CN'?'更多输入格式':'More input formats'}</p>{inputs.filter(input=>['tsv','yaml','xlsx'].includes(input)).map(input=><div className="p5-format-row" key={input}><strong>{routeLabel(input)}</strong><Icon name="arrow" size={14}/><span>{routes.filter(route=>route.input===input).map(route=>routeLabel(route.output)).join(' / ')}</span></div>)}</div>}
          </article>;
        })}</div><article className="ai-feature information"><h3>{t('aiFeature')}</h3><p>{t('aiFeatureDetails')}</p></article><p className="format-footnote">{t('formatFootnote')}</p>
      </section>}
      {mode === 'convert' && !phase5.snapshot.items.length && <section className="privacy-section" id="privacy"><div className="privacy-intro"><span className="privacy-banner-icon"><Icon name="shield" size={28} /></span><span className="eyebrow">{t('privacyEyebrow')}</span><h2>{t('privacyTitle')}</h2><p>{t('privacyDescription')}</p><button className="text-button" onClick={() => setShowPrivacy(true)}>{t('howPrivacy')} <Icon name="arrow" size={16} /></button></div><div className="privacy-diagram"><div className="privacy-flow">{(['yourFile', 'browser', 'result'] as const).map((step, i) => <div className="privacy-step" key={step}><span className="flow-node"><Icon name={i === 1 ? 'device' : i === 2 ? 'check' : 'file'} size={25} /></span><span>{t(step)}</span>{i < 2 && <span className="flow-arrow" aria-hidden="true"><Icon name="arrow" size={19} /></span>}</div>)}</div><div className="privacy-facts">{(['noUpload', 'noAccount', 'noTracking', 'noKey'] as const).map(key => <span key={key}><Icon name="check" size={14} />{t(key)}</span>)}</div></div></section>}
    </main>
    <footer><span className="footer-brand">FileFlow <span>{t('footerLocal')}</span></span><span>{t('footerMessage')}</span><span className="version">{t('version')}</span></footer>
    {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}
  </div>;
}

function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), { t } = useI18n();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={dialog} aria-labelledby="privacy-title" onKeyDown={trapFocus} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="dialog-header"><span className="category-icon privacy-icon"><Icon name="shield" size={25} /></span><button className="icon-button" aria-label={t('closePrivacy')} autoFocus onClick={onClose}><Icon name="close" /></button></div><h2 id="privacy-title">{t('privacyDialogTitle')}</h2>
    <div className="dialog-facts">{(['noUpload', 'noAccount', 'noTracking', 'noKey'] as const).map(key => <span key={key}><Icon name="check" size={14} />{t(key)}</span>)}</div>
    {getDesktopPlatform()&&<DesktopPrivacy/>}<p>{t('privacyProcessing')}</p><p>{t('aiPrivacy')}</p><p>{t('privacyMemory')}</p><p>{t('privacyAssets')}</p><p>{t('privacyLimits')}</p><button className="primary full" onClick={onClose}>{t('gotIt')}</button>
  </dialog>;
}
