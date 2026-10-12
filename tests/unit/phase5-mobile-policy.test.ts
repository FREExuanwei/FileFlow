import {expect,it} from 'vitest';
import {assertOperationInputLimit,operationSourceLimit} from '../../src/core/phase5/input-policy';
import {P5_LIMITS} from '../../src/core/phase5/limits';
it('narrow viewport halves every new operation source cap with exact boundary and plus one',()=>{
  const operations=[{kind:'hash',algorithm:'SHA-256'},{kind:'inspect',structural:false},{kind:'json',action:'format'},{kind:'route',routeId:'xlsx-to-json'},{kind:'route',routeId:'yaml-to-json'},{kind:'route',routeId:'json-to-yaml'},{kind:'route',routeId:'tsv-to-json'}] as const;
  for(const op of operations){const desktop=operationSourceLimit(op,false),mobile=operationSourceLimit(op,true);expect(mobile).toBe(desktop/2);expect(()=>assertOperationInputLimit(mobile,op,true)).not.toThrow();expect(()=>assertOperationInputLimit(mobile+1,op,true)).toThrow();expect(()=>assertOperationInputLimit(desktop,op,false)).not.toThrow();expect(()=>assertOperationInputLimit(desktop+1,op,false)).toThrow();}
  expect(operationSourceLimit({kind:'hash',algorithm:'SHA-256'},false)).toBe(P5_LIMITS.hashSource);
});
