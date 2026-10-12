import {expect,it,vi} from 'vitest';
import {parseSafeJson} from '../../src/core/phase5/safe-json';
const limits={depth:64,nodes:100000,scalarUnits:256*1024};
it('parses JSON exactly once after lexical validation and builds safe own properties',()=>{
  const spy=vi.spyOn(JSON,'parse');try{
    const r=parseSafeJson('{"__proto__":"fictional","constructor":2,"prototype":true,"nested":{"中文":"text"}}',limits);
    expect(spy).toHaveBeenCalledTimes(1);expect(Object.getPrototypeOf(r.value)).toBe(null);expect(Object.hasOwn(r.value as object,'__proto__')).toBe(true);expect(Object.prototype).not.toHaveProperty('fictional');
  }finally{spy.mockRestore();}
});
it.each(['{"x":1,"x":2}','{"a":1,"\\u0061":2}','{"x":9007199254740993}','{"x":1e100}','{"x":Infinity}','{"x":1,}','[1] trailing'])('rejects unsafe structure or precision before parse: %s',text=>{
  const spy=vi.spyOn(JSON,'parse');try{expect(()=>parseSafeJson(text,limits)).toThrow();expect(spy).not.toHaveBeenCalled();}finally{spy.mockRestore();}
});
it('enforces depth64, nodes including keys, and decoded scalar units',()=>{
  expect(()=>parseSafeJson('['.repeat(64)+'0'+']'.repeat(64),limits)).not.toThrow();
  expect(()=>parseSafeJson('['.repeat(65)+'0'+']'.repeat(65),limits)).toThrow();
  expect(()=>parseSafeJson('{"a":1}',{...limits,nodes:2})).toThrow();
  expect(()=>parseSafeJson('"'+'a'.repeat(256*1024)+'"',limits)).not.toThrow();
  expect(()=>parseSafeJson('"'+'a'.repeat(256*1024+1)+'"',limits)).toThrow();
});
it('keeps JSON booleans null decimals escaped Unicode and negative zero',()=>{
  expect(parseSafeJson('[true,false,null,1.25,-0,"\\u4e2d\\n\\t\\"\\\\"]',limits).value).toEqual([true,false,null,1.25,-0,'中\n\t"\\']);
});
