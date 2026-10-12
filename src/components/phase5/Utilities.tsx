import {nativeFileClick} from '../../adapters/platform';
import {useEffect,useState} from 'react';
import type {WorkspaceCoordinator,WorkspaceRow} from '../../core/phase5/workspace';
import type {P5Operation} from '../../core/phase5/types';
import {useI18n} from '../../i18n/Provider';
import {phase5Text} from '../../i18n/phase5';
import {toP5Input} from '../../adapters/web/phase5-input';
import {errorCode} from '../../core/phase5/errors';
export function Phase5ImportError({code}:{code:string}){const {language}=useI18n();return <p className="error" role="alert">{phase5Text(language,code)}</p>;}
function operation(value:string):Exclude<P5Operation,{kind:'route'}>{return value==='inspect'?{kind:'inspect',structural:false}:value==='hash'?{kind:'hash',algorithm:'SHA-256'}:{kind:'json',action:value==='format'?'format':value==='minify'?'minify':'validate'};}
export function Utilities({row,coordinator}:{row:WorkspaceRow;coordinator:WorkspaceCoordinator}){
  const {language}=useI18n(),p=(key:string)=>phase5Text(language,key),[error,setError]=useState<string>();const busy=['queued','processing','validating'].includes(row.job.status),canTransfer=row.owner==='phase5'||(row.format==='csv'||row.format==='json')&&row.job.status==='ready',disabled=busy||!row.job.input||!canTransfer;
  return <details className="p5-utilities"><summary>{p('utilities')}</summary><p className="small-note">{disabled?p('sourceAgain'):p('local')}</p><div className="p5-tool-actions">{['inspect','hash',...(row.format==='json'?['format','minify','validate']:[])].map(key=><button key={key} className="secondary" disabled={disabled} onClick={()=>{try{coordinator.configure(row.workspaceId,operation(key));setError(undefined);}catch(e){setError(errorCode(e));}}}>{p(key)}</button>)}</div>{error&&<p role="alert" className="error">{p(error)}</p>}</details>;
}
export function UtilityImport({coordinator,openRequest=0}:{coordinator:WorkspaceCoordinator;openRequest?:number}){
  const {language}=useI18n(),p=(key:string)=>phase5Text(language,key),[open,setOpen]=useState(false),[action,setAction]=useState('inspect'),[error,setError]=useState<string>();
  useEffect(()=>{if(openRequest>0)setOpen(true);},[openRequest]);
  return <div className="p5-utility-import" id="data-tools"><button className="text-button" aria-expanded={open} onClick={()=>setOpen(!open)}>{p('utilities')}</button>{open&&<div className="p5-utility-picker"><label htmlFor="p5-import-tool">{p('utilityAction')}</label><select id="p5-import-tool" value={action} onChange={e=>setAction(e.target.value)}>{['inspect','hash','format','minify','validate'].map(key=><option key={key} value={key}>{p(key)}</option>)}</select><label htmlFor="p5-utility-file">{p('chooseUtility')}</label><input id="p5-utility-file" type="file" onClick={event=>nativeFileClick(event,async files=>{const file=files[0];if(file)await coordinator.addUtility(toP5Input(file),operation(action)).then(()=>{setError(undefined);setOpen(false);},e=>setError(errorCode(e)));})} accept={['format','minify','validate'].includes(action)?'.json':undefined} onChange={event=>{const file=event.target.files?.[0];if(file)void coordinator.addUtility(toP5Input(file),operation(action)).then(()=>{setError(undefined);setOpen(false);},e=>setError(errorCode(e)));event.target.value='';}}/><p className="small-note">{p(action==='hash'?'originalHash':'inspectPrivacy')}</p>{error&&<p role="alert" className="error">{p(error)}</p>}</div>}</div>;
}
