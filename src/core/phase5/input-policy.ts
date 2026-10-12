import {P5_LIMITS} from './limits';
import type {P5Operation} from './types';
import {P5Error} from './errors';
export function operationSourceLimit(operation:P5Operation,narrow:boolean):number{
  const cap=operation.kind==='hash'?P5_LIMITS.hashSource:operation.kind==='inspect'?P5_LIMITS.inspectorSource:operation.kind==='json'?P5_LIMITS.structuredSource:operation.routeId.startsWith('xlsx-')?P5_LIMITS.xlsxSource:operation.routeId.includes('yaml')?P5_LIMITS.structuredSource:P5_LIMITS.dataSource;
  return narrow?cap/2:cap;
}
export function assertOperationInputLimit(size:number,operation:P5Operation,narrow:boolean):void{if(!Number.isSafeInteger(size)||size<0||size>operationSourceLimit(operation,narrow))throw new P5Error('size');}
