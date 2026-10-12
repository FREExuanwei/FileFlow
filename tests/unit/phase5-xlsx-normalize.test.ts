// @vitest-environment node
import {expect,it} from 'vitest';
import {normalizeSheet} from '../../src/converters/phase5/xlsx/normalize';
import type {XlsxEnvelope} from '../../src/converters/phase5/xlsx/zip-preflight';
const envelope=(rows=2,columns=3,dateSystem:'1900'|'1904'='1900'):XlsxEnvelope=>({sourceBytes:1,expandedBytes:1,entryCount:5,xmlMarkers:10,sharedStringUnits:0,numericLexemesChecked:true,dateSystem,sheets:[{id:'rId1',name:'Fiction',visibility:'visible',lastRow:rows,lastColumn:columns}]});
it('keeps only raw primitive cells and bounded display, never formula/hyperlink metadata',()=>{
  const result=normalizeSheet({'!ref':'A1:C2','!data':[[{t:'s',v:'虚构',l:{Target:'https://fiction.invalid'},c:[]},{t:'n',v:42,z:'0.00',w:'42.00'},{t:'b',v:true}],[undefined,{t:'z'},{t:'e',v:7,w:'#DIV/0!'}]]},envelope(),'rId1');
  expect(result.rows.map(row=>row.map(c=>c.raw))).toEqual([['虚构',42,true],[null,null,'#DIV/0!']]);expect(result.rows[0]![1]).toMatchObject({display:'42.00',numberFormat:'0.00',type:'number'});expect(JSON.stringify(result)).not.toContain('fiction.invalid');expect(result.notices).toContainEqual({code:'xlsx-errors',count:1});
});
it('missing cached formulas ignore stale display and produce counted nulls',()=>{
  const result=normalizeSheet({'!ref':'A1:C2','!data':[[{t:'s',v:'heading'}],[{t:'n',f:'1+2',w:'stale'},{t:'str',f:'"x"',w:'stale'},{t:'b',f:'TRUE()',w:'TRUE'}]]},envelope(),'rId1');
  expect(result.rows[1]!.map(c=>c.raw)).toEqual([null,null,null]);expect(result.rows[1]!.every(c=>c.display===undefined&&c.formulaCache==='missing')).toBe(true);expect(result.notices).toContainEqual({code:'xlsx-formula-missing',count:3});expect(JSON.stringify(result)).not.toContain('1+2');
});
it('retains cached formula primitives with stale-cache warning',()=>{
  const result=normalizeSheet({'!ref':'A1:C1','!data':[[{t:'n',v:3,f:'1+2'},{t:'s',v:'x',f:'"x"'},{t:'b',v:false,f:'FALSE()'}]]},envelope(1),'rId1');expect(result.rows[0]!.map(c=>c.raw)).toEqual([3,'x',false]);expect(result.notices).toContainEqual({code:'xlsx-formula-cached',count:3});
});
it('rejects entirely missing formula caches instead of pretending success',()=>{expect(()=>normalizeSheet({'!ref':'A1','!data':[[{t:'n',f:'1+2',w:'3'}]]},envelope(1,1),'rId1')).toThrow();});
for(const [dateSystem,serial,display] of [['1900',60,'1900-02-29'],['1900',61,'1900-03-01'],['1904',0,'1904-01-01'],['1900',0.5,'12:00:00']] as const)it(`formats fixed serial ${dateSystem}/${serial} without JS Date`,()=>{
  const result=normalizeSheet({'!ref':'A1','!data':[[{t:'n',v:serial,z:serial===0.5?'hh:mm:ss':'yyyy-mm-dd'}]]},envelope(1,1,dateSystem),'rId1');expect(result.rows[0]![0]).toMatchObject({raw:serial,display,dateStyled:true});expect(result.notices).toContainEqual({code:`xlsx-dates-${dateSystem}`,count:1});
});
it('retains hidden rows/columns and only merge anchor contents',()=>{
  const result=normalizeSheet({'!ref':'A1:C2','!data':[[{t:'s',v:'Anchor'},{t:'s',v:'Suppressed'}],[{t:'s',v:'Retained'}]],'!merges':[{s:{r:0,c:0},e:{r:0,c:1}}],'!rows':[{hidden:true}],'!cols':[{hidden:true}]},envelope(),'rId1');expect(result.rows[0]!.map(c=>c.raw)).toEqual(['Anchor',null,null]);expect(result.rows[1]![0]!.raw).toBe('Retained');expect(result.notices.map(n=>n.code)).toEqual(expect.arrayContaining(['xlsx-merged','xlsx-hidden-rows','xlsx-hidden-columns']));
});
it('rejects parser ranges outside verified envelope and unsafe raw values',()=>{
  for(const raw of [{'!ref':'A1:ZZ999999'}, {'!ref':'A1','!data':[[{t:'n',v:9007199254740992}]]},{'!ref':'A1','!data':[[{t:'d',v:new Date(0)}]]},{'!ref':'A1','!data':[[{t:'s',v:'x'.repeat(32769)}]]}])expect(()=>normalizeSheet(raw,envelope(),'rId1')).toThrow();
});
it('hidden sheets cannot normalize; sparse gaps remain null',()=>{
  const env=envelope();expect(normalizeSheet({'!ref':'B2',B2:{t:'s',v:'Fiction'}},env,'rId1').rows.map(r=>r.map(c=>c.raw))).toEqual([[null,null,null],[null,'Fiction',null]]);expect(()=>normalizeSheet({},env,'missing')).toThrow();expect(()=>normalizeSheet({},{...env,sheets:env.sheets.map(s=>({...s,visibility:'hidden'}))},'rId1')).toThrow();
});
