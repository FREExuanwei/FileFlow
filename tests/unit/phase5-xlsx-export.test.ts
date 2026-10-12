// @vitest-environment node
import {expect,it} from 'vitest';
import Papa from 'papaparse';
import {exportXlsxSheet} from '../../src/converters/phase5/xlsx/export';
import type {NormalizedCell,NormalizedSheet} from '../../src/converters/phase5/xlsx/normalize';
import type {P5Primitive} from '../../src/core/phase5/types';
function sheet(values:P5Primitive[][]):NormalizedSheet{return{sheetId:'rId1',dateSystem:'1900',notices:[],rows:values.map(row=>row.map(raw=>({raw,type:raw===null?'blank':typeof raw==='number'?'number':typeof raw==='boolean'?'boolean':'string',dateStyled:false,formulaCache:'none'} as NormalizedCell)))};}
it('CSV uses fixed date display while JSON keeps serial and warns',()=>{
  const value=sheet([['date','flag'],[46302,true]]);(value.rows[1]![0] as NormalizedCell).dateStyled=true;(value.rows[1]![0] as NormalizedCell).display='2026-10-07';
  expect(exportXlsxSheet(value,'csv','first-row').text).toBe('date,flag\r\n2026-10-07,true');const json=exportXlsxSheet(value,'json','first-row');expect(JSON.parse(json.text)).toEqual([{date:46302,flag:true}]);expect(json.notices).toContainEqual({code:'xlsx-json-date-serial',count:1});
});
it('CSV refuses uncertain date display, JSON still exports raw',()=>{const value=sheet([['date'],[46302]]);(value.rows[1]![0] as NormalizedCell).dateStyled=true;expect(()=>exportXlsxSheet(value,'csv','first-row')).toThrow('date-display');expect(JSON.parse(exportXlsxSheet(value,'json','first-row').text)).toEqual([{date:46302}]);});
it('first nonempty row is header, interior/trailing empty rows remain',()=>{
  const value=sheet([[null,null],['name','value'],['虚构',42],[null,null],[null,null]]),result=exportXlsxSheet(value,'json','first-row');expect(JSON.parse(result.text)).toEqual([{name:'虚构',value:42},{name:null,value:null},{name:null,value:null}]);expect(result).toMatchObject({rows:3,columns:2});expect(result.notices).toContainEqual({code:'xlsx-leading-empty-rows',count:1});
});
it('generated headers keep first data row and header-only JSON is empty',()=>{expect(JSON.parse(exportXlsxSheet(sheet([['First',1]]),'json','generated').text)).toEqual([{column_1:'First',column_2:1}]);expect(exportXlsxSheet(sheet([['one','two']]),'json','first-row').text).toBe('[]');});
for(const values of [[[null,null]],[['a','a']],[['a','']],[['a',42]]] as P5Primitive[][][])it(`rejects empty/invalid headers ${JSON.stringify(values)}`,()=>{expect(()=>exportXlsxSheet(sheet(values),'json','first-row')).toThrow();});
it('special own-property headers survive with no prototype mutation',()=>{const text=exportXlsxSheet(sheet([['__proto__','constructor','prototype'],['fiction',true,42]]),'json','first-row').text,value=JSON.parse(text);expect(Object.keys(value[0])).toEqual(['__proto__','constructor','prototype']);expect(value[0].__proto__).toBe('fiction');expect(({} as Record<string,unknown>).fiction).toBeUndefined();});
it('CSV neutralizes formula display/headers but preserves true negative numbers',()=>{
  const value=sheet([['=header','negative'],['@text',-42]]);(value.rows[1]![0] as NormalizedCell).display=' =display';const result=exportXlsxSheet(value,'csv','first-row');expect(Papa.parse(result.text).data).toEqual([["'=header",'negative'],["' =display",'-42']]);expect(result.notices).toContainEqual({code:'formula-neutralized',count:2});
});
it('missing formula nulls and existing warnings survive both exports',()=>{const value=sheet([['a','b','c'],[null,null,null]]);value.notices=[{code:'xlsx-formula-missing',count:3}];for(const target of ['csv','json'] as const){const result=exportXlsxSheet(value,target,'first-row');expect(result.notices).toContainEqual({code:'xlsx-formula-missing',count:3});expect(result.notices).toContainEqual({code:'xlsx-single-sheet'});}expect(JSON.parse(exportXlsxSheet(value,'json','first-row').text)).toEqual([{a:null,b:null,c:null}]);});
it('output bound rejects before large serialization',()=>{const values=[['large'],...Array.from({length:600},()=>['x'.repeat(32768)])];expect(()=>exportXlsxSheet(sheet(values),'json','first-row')).toThrow('output');expect(()=>exportXlsxSheet(sheet(values),'csv','first-row')).toThrow('output');});
