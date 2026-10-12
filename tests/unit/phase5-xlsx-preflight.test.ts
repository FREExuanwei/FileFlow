// @vitest-environment node
import {it,expect} from 'vitest';
import {fictionalWorkbook,fixtureZip,spreadsheetNs} from '../../scripts/phase5-xlsx-fixtures.mjs';
import {preflightXlsx} from '../../src/converters/phase5/xlsx/zip-preflight';
import {analyzeXlsxXml} from '../../src/converters/phase5/xlsx/xml-preflight';
const context=()=>({signal:new AbortController().signal});
const reject=async(bytes:Uint8Array)=>expect(preflightXlsx(bytes,context())).rejects.toThrow();
for(const deflate of [false,true])it(`accepts real independently generated OOXML ${deflate?'deflate':'stored'}`,async()=>{
  const {bytes}=fictionalWorkbook({deflate});const result=await preflightXlsx(bytes,context());expect(result).toMatchObject({sourceBytes:bytes.length,entryCount:5,numericLexemesChecked:true,dateSystem:'1900',sheets:[{id:'rId1',name:'Fictional',lastRow:2,lastColumn:2,visibility:'visible'}]});expect(result.expandedBytes).toBeGreaterThan(500);expect(result.xmlMarkers).toBeGreaterThan(10);
});
it('preserves date system and excludes no visibility information',async()=>{
  const {bytes}=fictionalWorkbook({date1904:true,sheets:[{name:'A',state:'visible'},{name:'B',state:'hidden'},{name:'C',state:'veryHidden'}]});expect((await preflightXlsx(bytes,context())).sheets.map(s=>s.visibility)).toEqual(['visible','hidden','veryHidden']);expect((await preflightXlsx(bytes,context())).dateSystem).toBe('1904');
});
it('source4MiB plus one rejected before container processing',async()=>{await expect(preflightXlsx(new Uint8Array(4*1024**2+1),context())).rejects.toMatchObject({code:'size'});});
for(const [name,extra] of [
  ['entries1025',Object.fromEntries(Array.from({length:1021},(_,i)=>[`fictional${i}.xml`,'<x/>']))],
  ['entry8MiB',{'xl/oversized.xml':'x'.repeat(8*1024**2+1)}],
  ['ratio101',{'xl/compressed.xml':'x'.repeat(100000)}],
  ['nested ZIP',{'xl/media/nested.zip':new Uint8Array([80,75,3,4])}],
  ['OLE',{'xl/embeddings/oleObject.bin':new Uint8Array([208,207,17,224])}],
  ['macro',{'xl/vbaProject.bin':'fictional'}],
  ['path traversal',{'../outside.xml':'<x/>'}],
  ['encoded separator',{'xl/%2fescape.xml':'<x/>'}],
  ['canonical duplicate',{'XL/WORKBOOK.XML':'<x/>'}],
] as const)it(`rejects ${name}`,async()=>{await reject(fictionalWorkbook({extra,deflate:name==='ratio101'||name==='entry8MiB'}).bytes);});
for(const [name,dimension,cells] of [
  ['rows20001','A1:A20001',''],['columns257','A1:IW1',''],['cells250001','A1:IV1000',''],
  ['forged range','A1:A1','<row r="2"><c r="A2"><v>1</v></c></row>'],
  ['invalid address','A1:A1','<row r="1"><c r="__proto__"><v>1</v></c></row>'],
  ['unsafe numeric lexeme','A1:A1','<row r="1"><c r="A1"><v>9007199254740993</v></c></row>'],
  ['nonfinite numeric','A1:A1','<row r="1"><c r="A1"><v>1e999</v></c></row>'],
  ['huge cell','A1:A1','<row r="1"><c r="A1" t="inlineStr"><is><t>'+'x'.repeat(32769)+'</t></is></c></row>'],
] as const)it(`rejects worksheet ${name}`,async()=>{await reject(fictionalWorkbook({dimension,cells}).bytes);});
it('rejects33 sheets',async()=>{await reject(fictionalWorkbook({sheets:Array.from({length:33},(_,i)=>({name:`Fiction${i}`,state:'visible'}))}).bytes);});
for(const [name,xml] of [['DTD','<!DOCTYPE a [<!ENTITY x "attack">]><a>&x;</a>'],['unknown entity','<a>&fictional;</a>'],['encoding','<?xml version="1.0" encoding="UTF-16"?><a/>'],['malformed','<a><b></a>'],['external PI','<?external https://fictional.invalid?><a/>'],['unbound namespace','<x:a/>'],['duplicate attr','<a x="1" x="2"/>']] as const)it(`rejects XML ${name}`,async()=>{await reject(fictionalWorkbook({extra:{'xl/attack.xml':xml}}).bytes);});
it('rejects500001 XML markers and invalid UTF8 without parser',async()=>{
  await reject(fictionalWorkbook({extra:{'xl/markers.xml':'<a>'+ '<b/>'.repeat(500001)+'</a>'}}).bytes);await reject(fictionalWorkbook({extra:{'xl/invalid.xml':new Uint8Array([60,97,62,195,40,60,47,97,62])}}).bytes);
});
it('CRC and local/central consistency are checked',async()=>{
  const original=fictionalWorkbook().bytes;
  for(const kind of ['crc','method','name','size','overlap','zip64','encrypted']){const bytes=Buffer.from(original),end=bytes.length-22,central=bytes.readUInt32LE(end+16);if(kind==='crc')bytes.writeUInt32LE(0,central+16);if(kind==='method')bytes.writeUInt16LE(8,8);if(kind==='name')bytes[30]=90;if(kind==='size')bytes.writeUInt32LE(999,22);if(kind==='overlap')bytes.writeUInt32LE(1,central+42);if(kind==='zip64')bytes.writeUInt32LE(0xffffffff,central+24);if(kind==='encrypted')bytes.writeUInt16LE(2049,central+8);await reject(bytes);}
});
it('rejects macro-enabled content type and unresolved worksheet relationship',async()=>{
  const {files}=fictionalWorkbook();await reject(fixtureZip({...files,'[Content_Types].xml':String(files['[Content_Types].xml']).replace('spreadsheetml.sheet.main','ms-excel.sheet.macroEnabled.main')}));await reject(fixtureZip({...files,'xl/_rels/workbook.xml.rels':String(files['xl/_rels/workbook.xml.rels']).replace('worksheets/sheet1.xml','../outside.xml')}));
});
it('accepts standard escaped text and rejects cancellation',async()=>{
  const bytes=fictionalWorkbook({cells:'<row r="1"><c r="A1" t="inlineStr"><is><t>&amp;&lt;&#20013;&#x6587;</t></is></c></row>'}).bytes;expect((await preflightXlsx(bytes,context())).numericLexemesChecked).toBe(true);
  const controller=new AbortController();controller.abort();await expect(preflightXlsx(bytes,{signal:controller.signal})).rejects.toMatchObject({code:'cancel'});
});
it('rejects UTF16 XML and duplicate cell coordinates',async()=>{
  await reject(fictionalWorkbook({extra:{'xl/utf16.xml':Buffer.from('<a/>','utf16le')}}).bytes);await reject(fictionalWorkbook({dimension:'A1:A1',cells:`<row r="1"><c r="A1"><v>1</v></c><c r="A1"><v>2</v></c></row>`}).bytes);expect(spreadsheetNs).toContain('spreadsheetml');
});
it('rejects control characters in CDATA and repeated value elements',async()=>{
  await reject(fictionalWorkbook({extra:{'xl/control.xml':'<a><![CDATA[\u0000]]></a>'}}).bytes);
  await reject(fictionalWorkbook({cells:'<row r="1"><c r="A1"><v>1</v><v>2</v></c></row>'}).bytes);
});
it('rejects aggregate expansion and shared string volume before parsing',async()=>{
  const bytes=fixtureZip({...fictionalWorkbook().files,...Object.fromEntries(Array.from({length:5},(_,i)=>[`xl/media/fiction${i}.dat`,Buffer.alloc(7*1024**2,65)]))},{deflate:true});
  // Keep declared ratio within 100 so the aggregate expanded-size guard is independently exercised.
  const end=bytes.length-22;let cursor=bytes.readUInt32LE(end+16);for(let n=0;n<bytes.readUInt16LE(end+10);n++){const local=bytes.readUInt32LE(cursor+42),size=bytes.readUInt32LE(cursor+24);if(size>1024**2){bytes.writeUInt32LE(size, cursor+20);bytes.writeUInt32LE(size,local+18);}cursor+=46+bytes.readUInt16LE(cursor+28)+bytes.readUInt16LE(cursor+30)+bytes.readUInt16LE(cursor+32);}
  await reject(bytes);
  // The archive's 8MiB entry limit normally rejects this first; exercise the independent XML cap directly.
  const shared='<sst xmlns="'+spreadsheetNs+'">'+('<si><t>'+ 'x'.repeat(32768)+'</t></si>').repeat(257)+'</sst>';
  const files=fictionalWorkbook({extra:{'xl/sharedStrings.xml':shared}}).files;
  expect(()=>analyzeXlsxXml(new Map(Object.entries(files).map(([name,value])=>[name,new Uint8Array(Buffer.from(value))])),context().signal)).toThrow();
});
