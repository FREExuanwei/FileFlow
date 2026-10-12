import {expect,it} from 'vitest';
import Papa from 'papaparse';
import {convertP5Data} from '../../src/converters/phase5/data';
import {buildSafeRecords,neutralizeCell,serializeDelimited} from '../../src/core/phase5/table';
it('roundtrips quotes tabs commas multiline Unicode and one BOM',()=>{
  const source='\ufeffname,note\r\n虚构,"comma, quote "" and\nnewline\ttab"';
  const tsv=convertP5Data('csv-to-tsv',source).text,csv=convertP5Data('tsv-to-csv',tsv).text;
  expect(Papa.parse(csv,{delimiter:','}).data).toEqual([['name','note'],['虚构','comma, quote " and\nnewline\ttab']]);
  expect(tsv.startsWith('\ufeff')).toBe(false);expect(tsv).toContain('\r\n');
  expect(convertP5Data('tsv-to-json','name\tvalue\r\n虚构\t42').text).toBe('[\n  {\n    "name": "虚构",\n    "value": "42"\n  }\n]');
});
it.each(['a,a\n1,2',',a\n1,2','a,b\n1','a,b\n1,2,3'])('rejects duplicate empty or uneven headers: %s',source=>{expect(()=>convertP5Data('csv-to-tsv',source)).toThrow();});
it('preserves all three special property names as own keys',()=>{
  const r=JSON.parse(convertP5Data('tsv-to-json','__proto__\tconstructor\tprototype\r\none\ttwo\tthree').text)[0];
  for(const [key,value]of [['__proto__','one'],['constructor','two'],['prototype','three']]){expect(Object.hasOwn(r,key!)).toBe(true);expect(r[key!]).toBe(value);}
  expect(Object.prototype).not.toHaveProperty('one');
  const records=buildSafeRecords({headers:['__proto__','constructor','prototype'],rows:[['one','two','three']]});expect(Object.getPrototypeOf(records[0])).toBe(null);
});
it.each(['=1',' +cmd','\ufeff-2','  @sum','\tfictional','\nfictional'])('neutralizes formula in headers and cells: %s',payload=>{
  const r=serializeDelimited({headers:[payload],rows:[[payload]]},',',1024);
  expect(Papa.parse<string[]>(r.text,{delimiter:','}).data).toEqual([["'"+payload],["'"+payload]]);expect(r.notices).toContainEqual({code:'formula-neutralized',count:2});
});
it('keeps numeric negative but protects text negative and quoted injection',()=>{
  expect(neutralizeCell(-42)).toEqual({value:-42,changed:false});expect(neutralizeCell('-42')).toEqual({value:"'-42",changed:true});
  const tsv=convertP5Data('json-to-tsv',JSON.stringify([{n:-42,text:'-42',quoted:'=HYPERLINK("https://fictional.invalid")'}])).text;
  expect(Papa.parse<string[]>(tsv,{delimiter:'\t'}).data[1]).toEqual(['-42',"'-42",`'=HYPERLINK("https://fictional.invalid")`]);
});
it('rejects sparse union amplification and counts header in cell cap',()=>{
  const rows=Array.from({length:1000},(_,i)=>({['fictional'+i]:i}));
  expect(()=>convertP5Data('json-to-tsv',JSON.stringify(rows))).toThrow();
  expect(()=>buildSafeRecords({headers:Array.from({length:1000},(_,i)=>'h'+i),rows:Array.from({length:1000},()=>Array(1000).fill(''))})).toThrow();
});
it('rejects nested JSON, empty array, and output before serialization',()=>{
  for(const text of ['[]','[{"nested":{}}]','[1]'])expect(()=>convertP5Data('json-to-tsv',text)).toThrow();
  expect(()=>serializeDelimited({headers:['name'],rows:[['fictional']]},',',4)).toThrow();
});
