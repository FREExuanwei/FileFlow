import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {initializeDesktop,getNotice} from '../../src/desktop/service';
import {DesktopStatus} from '../../src/desktop/Status';
import {LanguageProvider} from '../../src/i18n/Provider';
import {LANGUAGE_KEY} from '../../src/i18n';
import type {DesktopPlatform} from '../../src/adapters/platform';

// Only OS transport is substituted. Service, file adapter, resource accounting,
// notices and actual React rendering remain real. These are not manual E2E tests.
const transport=vi.hoisted(()=>({rejection:undefined as unknown,selected:[] as {id:string;name:string;size:number}[],warning:undefined as unknown,listeners:new Map<string,(event:{payload:unknown})=>void>()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:async(command:string)=>{
 if(command==='get_preferences')return {theme:'system',language:'zh-CN'};
 if(command==='pick_inputs'){
  if(transport.rejection!==undefined)throw transport.rejection;
  if(transport.warning)transport.listeners.get('fileflow-dialog-warning')?.({payload:transport.warning});
  return transport.selected;
 }
 if(command==='read_input')return new Uint8Array([97,44,98]).buffer;
 if(command==='release_input')return;
 throw Error('Unexpected transport command');
}}));
vi.mock('@tauri-apps/api/event',()=>({listen:async(name:string,callback:(event:{payload:unknown})=>void)=>{transport.listeners.set(name,callback);return()=>{};}}));

describe('desktop native import rejection feedback',()=>{
 let platform:DesktopPlatform,root:Root,container:HTMLDivElement;
 beforeAll(async()=>{
  (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
  platform=await initializeDesktop();
  container=document.createElement('div');document.body.append(container);
  root=createRoot(container);
  await act(async()=>root.render(createElement(LanguageProvider,null,createElement(DesktopStatus))));
 });
 afterAll(async()=>{await act(async()=>root.unmount());container.remove();});

 it('preserves the closed privacy error code without authorizing or allocating a file',async()=>{
  transport.rejection={code:'dialog_privacy_failed'};
  const admitted:File[]=[];
  await act(async()=>{
   try{await platform.pick(files=>{admitted.push(...files);},'.csv',true);}
   catch(error){platform.report(error);}
  });
  expect(admitted).toEqual([]);
  expect(platform.resources.budget.getTransientUsage()).toBe(0);
  expect(getNotice()).toEqual({kind:'error',code:'dialog_privacy_failed'});
 });

 it('brings the blocking alert into focus and explains that no file was imported',async()=>{
  await act(async()=>platform.report({code:'dialog_privacy_failed'}));
  const alert=container.querySelector('[role=alert]');
  expect(alert?.textContent).toContain('dialog_privacy_failed');
  expect(alert?.textContent).toContain('未导入');
  expect(document.activeElement).toBe(alert);
 });

 it('never renders arbitrary native error text or persists sensitive diagnostics',async()=>{
  const privateMarker='fictional-private-path-and-content-do-not-display';
  await act(async()=>platform.report({code:privateMarker,message:privateMarker,path:privateMarker}));
  expect(getNotice()?.code).toBe('native-operation-failed');
  expect(container.textContent).not.toContain(privateMarker);
  expect(JSON.stringify({...localStorage})).not.toContain(privateMarker);
 });

 it('keeps cleanup warnings separate from blocking authorization errors',async()=>{
  await act(async()=>{
   platform.report({code:'file_unavailable'});
   transport.listeners.get('fileflow-dialog-warning')?.({payload:{code:'dialog_history_cleanup_failed',hresult:2147500037,operation:'import'}});
  });
  expect(getNotice()?.kind).toBe('error');
  expect(getNotice()?.code).toBe('file_unavailable');
  expect((getNotice() as unknown as {historyWarning:unknown})?.historyWarning).toEqual({hresult:2147500037,operation:'import'});
  expect(container.querySelector('[data-dialog-history-warning]')?.textContent).toContain('本地历史');
 });

 it('admits a valid file despite a cleanup warning and releases its transfer lease',async()=>{
  transport.rejection=undefined;
  transport.selected=[{id:'fiction',name:'fiction.csv',size:3}];
  transport.warning={code:'dialog_history_cleanup_failed',hresult:2147500037,operation:'import'};
  const admitted:File[]=[];
  await act(async()=>platform.pick(files=>{admitted.push(...files);},'.csv',true));
  expect(admitted[0]?.name).toBe('fiction.csv');
  expect(admitted[0]?.size).toBe(3);
  expect(platform.resources.budget.getTransientUsage()).toBe(0);
  expect(getNotice()?.kind).toBe('imported');
  expect(container.querySelector('[data-dialog-history-warning]')?.textContent).toContain('0x80004005');
 });

 it('cancelled selection imports nothing even when cleanup emits a warning',async()=>{
  transport.selected=[];
  const admitted:File[]=[];
  await act(async()=>platform.pick(files=>{admitted.push(...files);},'.csv',true));
  expect(admitted).toEqual([]);
  expect(getNotice()?.kind).toBe('import-cancelled');
 });

 it('ignores malformed warning payloads and keeps warning metadata out of preferences',async()=>{
  const before=getNotice(),stored=JSON.stringify({...localStorage});
  await act(async()=>transport.listeners.get('fileflow-dialog-warning')?.({payload:{code:'dialog_history_cleanup_failed',hresult:'fictional-private-path',operation:'import'}}));
  expect(getNotice()).toEqual(before);
  expect(container.textContent).not.toContain('fictional-private-path');
  expect(JSON.stringify({...localStorage})).toBe(stored);
 });

 it('shows the English warning and dismisses session feedback without persisting it',async()=>{
  localStorage.setItem(LANGUAGE_KEY,'en');
  await act(async()=>root.render(createElement(LanguageProvider,{key:'english',children:createElement(DesktopStatus)})));
  expect(container.querySelector('[data-dialog-history-warning]')?.textContent).toContain('local file-dialog history');
  expect(container.textContent).toContain('Import cancelled');
  await act(async()=>{(container.querySelector('.desktop-dismiss') as HTMLButtonElement).click();});
  expect(getNotice()).toBeUndefined();
  expect(container.querySelector('[data-dialog-history-warning]')).toBeNull();
  expect(JSON.stringify({...localStorage})).not.toContain('2147500037');
 });

 it('dismisses repetitive history warnings independently while preserving a save error',async()=>{
  const stored=JSON.stringify({...localStorage});
  const warning={code:'dialog_history_cleanup_failed',hresult:2147942405,operation:'save'};
  await act(async()=>{
   platform.report({code:'save_failed'});
   transport.listeners.get('fileflow-dialog-warning')?.({payload:warning});
  });
  const button=container.querySelector('.desktop-warning-dismiss') as HTMLButtonElement|null;
  expect(button).not.toBeNull();
  await act(async()=>button?.click());
  expect(container.querySelector('[data-dialog-history-warning]')).toBeNull();
  expect(container.querySelector('[role=alert]')?.textContent).toContain('save_failed');
  await act(async()=>transport.listeners.get('fileflow-dialog-warning')?.({payload:warning}));
  expect(container.querySelector('[data-dialog-history-warning]')).toBeNull();
  expect(getNotice()?.code).toBe('save_failed');
  expect(JSON.stringify({...localStorage})).toBe(stored);
 });
});
