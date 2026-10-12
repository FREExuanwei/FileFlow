import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {DesktopFiles,type NativeGrant} from '../adapters/desktop/files';
import {installDesktopPlatform,type DesktopPlatform} from '../adapters/platform';
import {ResourceBudget} from '../core/resources/budget';
import {ExecutionGate} from '../core/resources/execution';
import {LANGUAGE_KEY} from '../i18n';
import {installFileEnvironment} from '../core/files/policy';
export type DesktopNotice={kind:'saving'|'saved'|'cancelled'|'error'|'warning'|'importing'|'imported'|'import-cancelled';code?:string;historyWarning?:{hresult:number;operation:'import'|'save'}};
let notice:DesktopNotice|undefined;const listeners=new Set<()=>void>();
const dismissedHistoryWarnings=new Set<number>();
export const subscribeNotice=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getNotice=()=>notice;
const update=(value:DesktopNotice)=>{notice=value.historyWarning||!notice?.historyWarning?value:{...value,historyWarning:notice.historyWarning};listeners.forEach(l=>l());};
export function dismissDesktopHistoryWarning(){if(!notice?.historyWarning)return;dismissedHistoryWarnings.add(notice.historyWarning.hresult);const {historyWarning:discarded,...remaining}=notice;void discarded;notice=remaining.kind==='warning'?undefined:remaining;listeners.forEach(l=>l());}
export function dismissDesktopNotice(){if(notice?.historyWarning)dismissedHistoryWarnings.add(notice.historyWarning.hresult);notice=undefined;listeners.forEach(l=>l());}
const code=(error:unknown)=>{const candidate=typeof error==='object'&&error&&'code'in error?String(error.code):error instanceof Error?error.message:'';return ['target_exists','resource-limit','limit','write_failed','save_failed','file_unavailable','reparse_point','cancelled','invalid-grant','read-failed','dialog_privacy_failed','dialog_show_and_clear_failed','dialog_show_failed','dialog_create_failed','dialog_identity_failed','dialog_options_failed','dialog_failed','dialog_busy','invalid_filter','untrusted_origin','unknown_grant','expired_grant','unsafe_path','unsafe_name','read_failed'].includes(candidate)?candidate:'native-operation-failed';};
let cancelActive=()=>{};
export function cancelDesktopSave(){cancelActive();}
export async function initializeDesktop(){
 installFileEnvironment('desktop');
 const budget=new ResourceBudget(),resources={budget,execution:new ExecutionGate()};
 const files=new DesktopFiles({pick:(accept='',multiple=true)=>invoke('pick_inputs',{accept,multiple}),read:(id,offset,length)=>invoke('read_input',{id,offset,length}),release:id=>invoke('release_input',{id}),chooseSave:(name,size)=>invoke<NativeGrant|null>('choose_save',{name,size}).then(g=>g??undefined),write:(id,offset,bytes)=>invoke('write_save',bytes,{headers:{'x-fileflow-grant':id,'x-fileflow-offset':String(offset)}}),commit:id=>invoke('commit_save',{id}),abort:id=>invoke('abort_save',{id})},budget);
 let pending=Promise.resolve();let importer:Parameters<DesktopPlatform['importer']>[0]|undefined;
 const platform:DesktopPlatform={resources,async pick(admit,accept,multiple){update({kind:'importing'});let imported=0;try{await files.importPicked(async selected=>{await admit(selected);imported+=selected.length;},accept,multiple);update({kind:imported?'imported':'import-cancelled'});}catch(error){platform.report(error);throw error;}},importer:admit=>{importer=admit;return()=>{if(importer===admit)importer=undefined;};},report:error=>update({kind:'error',code:code(error)}),
  save(blob,name){const lease=budget.reserve('transient',blob.size,'desktop-pending-export'),controller=new AbortController();pending=pending.catch(()=>{}).then(async()=>{cancelActive=()=>controller.abort();try{if(controller.signal.aborted){update({kind:'cancelled'});return;}update({kind:'saving'});const saved=await files.exportBlob(blob,name,controller.signal);update({kind:saved?'saved':'cancelled'});}catch(error){update(controller.signal.aborted?{kind:'cancelled'}:{kind:'error',code:code(error)});}finally{lease.release();cancelActive=()=>{};}});return()=>controller.abort();},
  preference(){const theme=localStorage.getItem('fileflow-theme')??'system',language=localStorage.getItem(LANGUAGE_KEY)??'';void invoke('set_preferences',{theme,language}).catch(platform.report);}
 };
 const preferences=await invoke<{theme:string;language:string}>('get_preferences');if(['light','dark','system'].includes(preferences.theme))localStorage.setItem('fileflow-theme',preferences.theme);if(['zh-CN','en'].includes(preferences.language))localStorage.setItem(LANGUAGE_KEY,preferences.language);
 installDesktopPlatform(platform);
 await listen<NativeGrant[]>('fileflow-drop',event=>{if(importer)void files.importGrants(event.payload,importer).catch(platform.report);else void Promise.allSettled(event.payload.map(g=>invoke('release_input',{id:g.id})));});
 await listen<{code:string}>('fileflow-native-error',event=>platform.report(event.payload));
 await listen<unknown>('fileflow-dialog-warning',event=>{
  const p=event.payload;if(typeof p!=='object'||p===null)return;
  const value=p as Record<string,unknown>;
  if(value.code!=='dialog_history_cleanup_failed'||typeof value.hresult!=='number'||!Number.isInteger(value.hresult)||value.hresult<0x80000000||value.hresult>0xffffffff||(value.operation!=='import'&&value.operation!=='save'))return;
  if(dismissedHistoryWarnings.has(value.hresult))return;
  update({...notice??{kind:'warning'},historyWarning:{hresult:value.hresult,operation:value.operation}});
 },{target:{kind:'WebviewWindow',label:'main'}});
 return platform;
}
