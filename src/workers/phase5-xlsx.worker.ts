import {inspectWorkbookBytes,readSelectedSheet} from '../converters/phase5/xlsx/parser';
import {preflightXlsx} from '../converters/phase5/xlsx/zip-preflight';
import {safeOutputName} from '../core/files/names';
import {errorCode,P5Error} from '../core/phase5/errors';
import {assertLimit,P5_LIMITS} from '../core/phase5/limits';
import type {P5Message,P5Input,P5Operation} from '../core/phase5/types';
type Request={action:'inspect';blob:Blob}|{action:'convert';input:P5Input;operation:Extract<P5Operation,{kind:'route'}>};
const scope=self as unknown as {onmessage:((event:MessageEvent<P5Message<{type:'run';input:Request}>>)=>void)|null;postMessage:(value:unknown)=>void};
scope.onmessage=async({data})=>{
  try{
    const request=data.payload.input,blob=request.action==='inspect'?request.blob:request.input.blob;if(!(blob instanceof Blob))throw new P5Error('input');assertLimit('xlsxSource',blob.size);
    const bytes=new Uint8Array(await blob.arrayBuffer()),signal=new AbortController().signal;let value:unknown;
    if(request.action==='inspect')value=await inspectWorkbookBytes(bytes,signal);
    else if(request.action==='convert'){
      const {input,operation}=request;if(input.size!==blob.size||!['xlsx-to-csv','xlsx-to-json'].includes(operation.routeId))throw new P5Error('input');
      const envelope=await preflightXlsx(bytes,{signal}),visible=envelope.sheets.filter(s=>s.visibility==='visible'),sheetId=operation.sheetId??(visible.length===1?visible[0]!.id:undefined);if(!sheetId)throw new P5Error('input');
      const raw=await readSelectedSheet(bytes,sheetId,envelope,signal),{normalizeSheet}=await import('../converters/phase5/xlsx/normalize'),{exportXlsxSheet}=await import('../converters/phase5/xlsx/export'),target=operation.routeId==='xlsx-to-csv'?'csv':'json',result=exportXlsxSheet(normalizeSheet(raw,envelope,sheetId),target,operation.headers??'first-row');
      value={kind:'file',name:safeOutputName(input.name,target),format:target,blob:new Blob([result.text],{type:target==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}),preview:result.text.slice(0,P5_LIMITS.previewUnits),notices:result.notices,rows:result.rows,columns:result.columns};
    }else throw new P5Error('input');
    scope.postMessage({...data,payload:{type:'result',value}});
  }catch(error){scope.postMessage({...data,payload:{type:'error',code:errorCode(error)}});}
};
