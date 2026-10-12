import {useState} from 'react';
import type {P5Result} from '../../core/phase5/types';
import {useI18n} from '../../i18n/Provider';
import {phase5Text,phase5Messages} from '../../i18n/phase5';
import {Icon} from '../Icon';
import {formatBytes} from '../../utils/format';
export function Result({result,save}:{result:P5Result;save:(blob:Blob,name:string)=>void}){
  const {language,t}=useI18n(),p=(key:string,parameters:Record<string,string|number>={})=>phase5Text(language,key,parameters),[notice,setNotice]=useState<string>();const report=result.kind==='report'?JSON.stringify(result.fields,null,2):undefined;
  function download(){try{save(result.kind==='file'?result.blob:new Blob([report!],{type:'application/json;charset=utf-8'}),result.kind==='file'?result.name:`fileflow-${result.reportType}.json`);setNotice(undefined);}catch{setNotice('downloadFailed');}}
  async function copy(){try{await navigator.clipboard.writeText(result.kind==='file'?result.preview:report!);setNotice('copied');}catch{setNotice('copyFailed');}}
  const invalid=result.kind==='report'&&result.reportType==='validation'&&result.fields.valid===false;
  return <><div className="result-summary p5-result" data-invalid={invalid} data-warning={result.notices.length>0}><div className="success-header"><span className="success-icon"><Icon name={invalid?'close':'check'} size={15}/></span>{t(invalid?'state_failed':result.notices.length?'state_warning':'state_completed')}</div><h2>{result.kind==='file'?result.name:p('report')}</h2>{result.kind==='file'&&<p className="small-note">{formatBytes(result.blob.size)} · {result.rows??0} × {result.columns??0}</p>}
    <div className="result-actions"><button className="download-button" onClick={download}><Icon name="download" size={18}/>{t('download')}</button><button className="secondary" onClick={()=>void copy()}>{p(result.kind==='file'?'copyPreview':'copy')}</button></div>
    {result.notices.map((n,i)=><p className="notice" key={`${n.code}-${i}`}>{p(n.code,{count:n.count??0})}</p>)}{notice&&<p className="information" role="status">{p(notice)}</p>}
    {result.kind==='report'&&<dl className="p5-report">{Object.entries(result.fields).map(([key,value])=><div key={key}><dt>{p(key==='size'?'sizeField':key==='hash'?'hashField':key==='valid'?'validField':key)}</dt><dd>{typeof value==='string'&&Object.hasOwn(phase5Messages[language],value)?p(value):typeof value==='boolean'?p(String(value)):value===null?'':String(value)}</dd></div>)}</dl>}</div>
    <div className="preview-panel"><div className="preview-toolbar"><span>{t('preview')}</span></div><pre className="source-preview">{result.kind==='file'?result.preview:report}</pre>{result.kind==='file'&&<p className="small-note">{p('previewBound')}</p>}</div>
  </>;
}
