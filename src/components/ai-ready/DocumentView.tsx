import { useEffect,useMemo,useRef } from 'react';
import type { AiResult } from '../../core/ai-ready/types';
import { Preview } from '../Preview';
import { useI18n } from '../../i18n/Provider';
export function AiDocumentView({result,view,selectedChunkId,outlineId}:{result:AiResult;view:'before'|'after';selectedChunkId?:string;outlineId?:string}){
  const {t}=useI18n(),mark=useRef<HTMLElement>(null);
  const heading=result.outline.find(h=>h.id===outlineId),chunk=result.chunks.find(c=>c.id===selectedChunkId);
  const text=useMemo(()=>{
    if(view==='before'){let remaining=200000;const parts:string[]=[];for(const page of result.extracted.pages){if(remaining<=0)break;const piece=page.markdown.slice(0,remaining);parts.push(piece);remaining-=piece.length+2;}return parts.join('\n\n').slice(0,200000);}
    if(heading)return result.cleaned.markdown.slice(Math.max(0,heading.start-1000),Math.max(0,heading.start-1000)+200000);
    if(chunk){const start=chunk.overlap?.start??chunk.primary.start;return result.cleaned.markdown.slice(start,Math.min(chunk.primary.end,start+200000));}
    return result.cleaned.markdown.slice(0,200000);
  },[result,view,heading,chunk]);
  useEffect(()=>{if(heading){mark.current?.scrollIntoView({block:'center'});mark.current?.focus({preventScroll:true});}},[heading]);
  const preview=useMemo(()=>({name:'preview.md',format:'md' as const,blob:new Blob([]),text,warnings:[]}),[text]);
  // The bounded source window remains text-only; directory navigation never relaxes iframe sandbox.
  if(heading&&view==='after'){const start=heading.start-Math.max(0,heading.start-1000),end=Math.min(text.length,start+heading.end-heading.start);return <div className="ai-document-view"><p className="small-note">{t('aiWindow')}</p><pre className="source-preview">{text.slice(0,start)}<mark ref={mark} tabIndex={-1}>{text.slice(start,end)}</mark>{text.slice(end)}</pre></div>;}
  return <div className="ai-document-view">{view==='before'?<pre className="source-preview">{text}</pre>:<Preview result={preview} truncated={chunk?chunk.primary.end-(chunk.overlap?.start??chunk.primary.start)>200000:result.cleaned.markdown.length>200000}/>}</div>;
}
