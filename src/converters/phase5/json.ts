import type {P5FileResult,P5ReportResult,SafeJson} from '../../core/phase5/types';
import {parseSafeJson} from '../../core/phase5/safe-json';
import {P5_LIMITS,assertLimit} from '../../core/phase5/limits';
import {P5Error,errorCode,type P5ErrorCode} from '../../core/phase5/errors';
import {utf8Bytes} from '../../core/phase5/table';
import {stringifyBounded} from '../../core/phase5/serialize';
export type JsonAction='format'|'minify'|'validate';
export interface JsonCoreSession {run(action:JsonAction):P5FileResult|P5ReportResult;dispose():void}
export function createJsonSession(text:string):JsonCoreSession{
  assertLimit('structuredSource',utf8Bytes(text));let parsed:SafeJson|undefined,invalid:P5ErrorCode|undefined,disposed=false;
  try{parsed=parseSafeJson(text.replace(/^\uFEFF/,''),P5_LIMITS);}catch(error){invalid=errorCode(error);}
  return{
    run(action):P5FileResult|P5ReportResult{
      if(disposed)throw new P5Error('stale');
      if(action==='validate')return{kind:'report',reportType:'validation',fields:parsed?{valid:true,nodes:parsed.nodes,depth:parsed.depth}:{valid:false,code:invalid??'structure',subset:'FileFlow safe JSON subset'},notices:[]};
      if(action!=='format'&&action!=='minify')throw new P5Error('type');
      if(!parsed)throw new P5Error(invalid??'structure');
      const text=stringifyBounded(parsed.value,action==='format'?2:0,P5_LIMITS.structuredOutput);
      return{kind:'file',name:'converted.json',format:'json',blob:new Blob([text],{type:'application/json;charset=utf-8'}),preview:text.slice(0,P5_LIMITS.previewUnits),notices:[]};
    },
    dispose(){disposed=true;parsed=undefined;invalid=undefined;},
  };
}
