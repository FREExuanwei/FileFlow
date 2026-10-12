// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {OcrWorkspace} from '../../src/components/ocr/Workspace';
import {LanguageProvider} from '../../src/i18n/Provider';
import {OcrQueue} from '../../src/core/ocr/queue';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
it('OCR partial output remains selectable with explicit partial warning and both local export formats',async()=>{
 (globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 const q=new OcrQueue({budget:new ResourceBudget(),execution:new ExecutionGate(),process:async()=>({pages:[{number:1,status:'completed',origin:'ocr',text:'虚构结果'},{number:2,status:'failed',origin:'ocr',text:''}],partial:true})});
 q.add([{name:'fiction.png',type:'image/png',size:4,blob:new Blob([new Uint8Array(4)])}]);q.startAll();await new Promise(r=>setTimeout(r,0));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>{root.render(createElement(LanguageProvider,null,createElement(OcrWorkspace,{queue:q,snapshot:q.getSnapshot(),info:{id:'windows-media-ocr',installedLanguages:['zh-Hans-CN'],modes:['eng','chi_sim','chi_sim+eng'],maxSide:4096,englishFallback:true}})));});
 expect(host.querySelector('textarea')?.value).toContain('虚构结果');expect(host.querySelector('.ocr-partial')?.textContent).toMatch(/部分|Partial/);expect(host.querySelectorAll('.ocr-export')).toHaveLength(2);expect(host.querySelector('.ocr-language-note')?.textContent).toMatch(/英语|English/);await act(async()=>root.unmount());q.dispose();host.remove();
});
