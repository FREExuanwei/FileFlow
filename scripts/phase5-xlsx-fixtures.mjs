import {deflateRawSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function fixtureCrc(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function fixtureZip(files,{deflate=false}={}){
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of Object.entries(files)){
    const filename=Buffer.from(name),data=Buffer.from(value),packed=deflate?deflateRawSync(data):data,crc=fixtureCrc(data),method=deflate?8:0,local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(2048,6);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(2048,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,filename,packed);centrals.push(central,filename);offset+=local.length+filename.length+packed.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(centrals.length/2,8);end.writeUInt16LE(centrals.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);
}
export const spreadsheetNs='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationNs='http://schemas.openxmlformats.org/package/2006/relationships',officeNs='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export function fictionalWorkbook({sheets=[{name:'Fictional',state:'visible'}],dimension='A1:B2',cells='<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>虚构</t></is></c><c r="B2"><v>42</v></c></row>',date1904=false,extra={},deflate=false}={}){
  const files={
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':`<Relationships xmlns="${relationNs}"><Relationship Id="root1" Type="${officeNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<workbook xmlns="${spreadsheetNs}" xmlns:r="${officeNs}"><workbookPr date1904="${date1904?'1':'0'}"/><sheets>${sheets.map((s,i)=>`<sheet name="${s.name}" sheetId="${i+1}" state="${s.state}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${relationNs}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${officeNs}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`,
    ...Object.fromEntries(sheets.map((_,i)=>[`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${spreadsheetNs}"><dimension ref="${dimension}"/><sheetData>${cells}</sheetData></worksheet>`])),...extra,
  };
  return{files,bytes:fixtureZip(files,{deflate})};
}
export function semanticWorkbook(date1904=false){
  const cells='<row r="1"><c r="A1" t="inlineStr"><is><t>date</t></is></c><c r="B1" t="inlineStr"><is><t>cached</t></is></c><c r="C1" t="inlineStr"><is><t>missing</t></is></c><c r="D1" t="inlineStr"><is><t>flag</t></is></c></row><row r="2"><c r="A2" s="1"><v>'+(date1904?44840:46302)+'</v></c><c r="B2"><f>1+2</f><v>3</v></c><c r="C2"><f>2+3</f></c><c r="D2" t="b"><v>1</v></c></row>';
  const {files}=fictionalWorkbook({date1904,dimension:'A1:D2',cells});
  files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="style1" Type="${officeNs}/styles" Target="styles.xml"/></Relationships>`);
  files['xl/styles.xml']=`<styleSheet xmlns="${spreadsheetNs}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="1"><font/></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  return{files,bytes:fixtureZip(files,{deflate:true})};
}
if(process.argv.includes('--write')){
  const directory='tests/phase5-fixtures';mkdirSync(directory,{recursive:true});const fixtures={
    'fictional.xlsx':fictionalWorkbook().bytes,
    'fictional-multi.xlsx':fictionalWorkbook({sheets:[{name:'Fictional A',state:'visible'},{name:'Fictional B',state:'visible'},{name:'Excluded',state:'hidden'},{name:'Private-looking fiction',state:'veryHidden'}]}).bytes,
    'fictional-deflated.xlsx':fictionalWorkbook({deflate:true}).bytes,
    'fictional-semantics-1900.xlsx':semanticWorkbook().bytes,
    'fictional-semantics-1904.xlsx':semanticWorkbook(true).bytes,
  };for(const [name,bytes] of Object.entries(fixtures))writeFileSync(`${directory}/${name}`,bytes);writeFileSync(`${directory}/xlsx-manifest.json`,JSON.stringify({fictional:true,writer:'Pure Node ZIP/XML, independent of SheetJS',command:'node scripts/phase5-xlsx-fixtures.mjs --write',files:Object.entries(fixtures).map(([name,bytes])=>({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))},null,2)+'\n');
}
