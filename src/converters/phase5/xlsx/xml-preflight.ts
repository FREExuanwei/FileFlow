import {P5Error} from '../../../core/phase5/errors';
import {P5_LIMITS as limits,assertLimit} from '../../../core/phase5/limits';
import type {XlsxEnvelope} from './zip-preflight';
const sheetNs='http://schemas.openxmlformats.org/spreadsheetml/2006/main',relsNs='http://schemas.openxmlformats.org/package/2006/relationships',officeNs='http://schemas.openxmlformats.org/officeDocument/2006/relationships',typesNs='http://schemas.openxmlformats.org/package/2006/content-types';
function fail():never{throw new P5Error('structure');}
function validCharacters(text:string){for(const c of text){const n=c.codePointAt(0)!;if(n<32&&n!==9&&n!==10&&n!==13||n===65534||n===65535)fail();}}
function entityText(text:string):string{
  validCharacters(text);
  const output:string[]=[];let cursor=0;
  while(cursor<text.length){const at=text.indexOf('&',cursor);if(at<0){output.push(text.slice(cursor));break;}output.push(text.slice(cursor,at));const end=text.indexOf(';',at+1);if(end<0||end-at>16)return fail();const code=text.slice(at+1,end),known:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(Object.hasOwn(known,code))output.push(known[code]!);else if(/^#(?:[0-9]+|x[a-fA-F0-9]+)$/.test(code)){const n=code[1]==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);if(n<32&&![9,10,13].includes(n)||n>1114111||n>=55296&&n<=57343||n===65534||n===65535)return fail();output.push(String.fromCodePoint(n));}else return fail();cursor=end+1;
  }return output.join('');
}
interface Element{name:string;local:string;ns:string;attrs:Record<string,string>}
type XmlHandlers={open?:(node:Element,parent?:Element)=>void;close?:(node:Element)=>void;text?:(text:string,parent:Element)=>void};
/** Narrow validating tokenizer, no DOM/entities/DTD, no retained tree. */
function scanXml(text:string,state:{markers:number},signal:AbortSignal,handlers:XmlHandlers,namespace?:string,rootName?:string){
  let i=0,roots=0;const stack:{node:Element;bindings:Record<string,string>}[]=[];
  const mark=(count=1)=>{state.markers+=count;assertLimit('xlsxXmlMarkers',state.markers);if(signal.aborted)throw new P5Error('cancel');};
  const binding=(prefix:string,own?:Record<string,string>)=>{if(prefix==='xml')return'http://www.w3.org/XML/1998/namespace';if(own&&Object.hasOwn(own,prefix))return own[prefix]!;for(let n=stack.length-1;n>=0;n--)if(Object.hasOwn(stack[n]!.bindings,prefix))return stack[n]!.bindings[prefix]!;return prefix?fail():'';};
  const textValue=(raw:string,cdata=false)=>{validCharacters(raw);if(!stack.length){if(raw.trim())fail();return;}if(raw.includes(']]>')&&!cdata)fail();const value=cdata?raw:entityText(raw);handlers.text?.(value,stack.at(-1)!.node);};
  while(i<text.length){
    if(text[i]!=='<'){const next=text.indexOf('<',i),end=next<0?text.length:next;textValue(text.slice(i,end));i=end;continue;}mark();
    if(text.startsWith('<!--',i)){const end=text.indexOf('-->',i+4);if(end<0||text.slice(i+4,end).includes('--'))fail();i=end+3;continue;}
    if(text.startsWith('<![CDATA[',i)){if(!stack.length)fail();const end=text.indexOf(']]>',i+9);if(end<0)fail();textValue(text.slice(i+9,end),true);i=end+3;continue;}
    if(text.startsWith('<?',i)){const end=text.indexOf('?>',i+2);if(i!==0||end<0)fail();const declaration=text.slice(i,end+2);if(!/^<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?(?:\s+standalone=["'](?:yes|no)["'])?\s*\?>$/i.test(declaration))fail();i=end+2;continue;}
    if(text.startsWith('<!',i))fail();
    const closing=text[i+1]==='/';i+=closing?2:1;const start=i;while(i<text.length&&!/[\s/>]/.test(text[i]!))i++;const name=text.slice(start,i);if(!/^(?:[A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*$/.test(name))fail();
    const attrs:Record<string,string>=Object.create(null),bindings:Record<string,string>=Object.create(null);let selfClose=false;
    while(i<text.length){let spaced=false;while(/\s/.test(text[i]??'')){i++;spaced=true;}if(text.startsWith('/>',i)){selfClose=true;i+=2;break;}if(text[i]==='>'){i++;break;}if(closing||!spaced)fail();const a=i;while(i<text.length&&!/[\s=/>]/.test(text[i]!))i++;const key=text.slice(a,i);if(!/^(?:[A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*$/.test(key)||Object.hasOwn(attrs,key))fail();while(/\s/.test(text[i]??''))i++;if(text[i++]!=='=')fail();while(/\s/.test(text[i]??''))i++;const quote=text[i++];if(quote!=='"'&&quote!=="'")fail();const end=text.indexOf(quote,i);if(end<0||end-i>limits.xlsxCellUnits||text.slice(i,end).includes('<'))fail();attrs[key]=entityText(text.slice(i,end));i=end+1;mark();if(Object.keys(attrs).length>64)throw new P5Error('size');if(key==='xmlns')bindings['']=attrs[key]!;else if(key.startsWith('xmlns:'))bindings[key.slice(6)]=attrs[key]!;}
    if(i>text.length||text[i-1]!=='>')fail();
    if(closing){if(selfClose||stack.at(-1)?.node.name!==name)fail();const closed=stack.pop()!;handlers.close?.(closed.node);continue;}
    const parts=name.split(':'),prefix=parts.length===2?parts[0]!:'',local=parts.at(-1)!,ns=binding(prefix,bindings),node={name,local,ns,attrs};
    for(const key of Object.keys(attrs)){const prefix=key.includes(':')?key.split(':')[0]:undefined;if(prefix&&prefix!=='xmlns')binding(prefix,bindings);}
    if(namespace&&ns!==namespace)fail();if(!stack.length){if(++roots!==1||rootName&&local!==rootName)fail();}
    if(stack.length>=64)throw new P5Error('size');handlers.open?.(node,stack.at(-1)?.node);stack.push({node,bindings});if(selfClose){const closed=stack.pop()!;handlers.close?.(closed.node);}
  }
  if(stack.length||roots!==1)fail();
}
function address(text:string){const m=/^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(text);if(!m)return fail();let column=0;for(const c of m[1]!)column=column*26+c.charCodeAt(0)-64;const row=Number(m[2]);assertLimit('xlsxRows',row);assertLimit('xlsxColumns',column);return{row,column};}
function range(text:string){const parts=text.split(':');if(parts.length>2)fail();const start=address(parts[0]!),end=address(parts[1]??parts[0]!);if(start.row>end.row||start.column>end.column)fail();assertLimit('xlsxCells',end.row*end.column);return{start,end};}
function targetPath(base:string,target:string){if(!target||target.includes('%')||target.includes('\\')||target.includes(':')||target.startsWith('//')||target.includes('?')||target.includes('#'))return fail();const parts=target.startsWith('/')?[]:base.split('/').filter(Boolean);for(const part of target.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return fail();parts.pop();}else parts.push(part);}return parts.join('/');}
export function analyzeXlsxXml(contents:Map<string,Uint8Array>,signal:AbortSignal){
  const state={markers:0},scanned=new Set<string>(),decoder=new TextDecoder('utf-8',{fatal:true});
  const scan=(path:string,handlers:XmlHandlers={},namespace?:string,root?:string)=>{const bytes=contents.get(path);if(!bytes)return fail();let text:string;try{text=decoder.decode(bytes);}catch{throw new P5Error('utf8');}scanXml(text,state,signal,handlers,namespace,root);scanned.add(path);};
  const contentTypes=new Map<string,string>();scan('[Content_Types].xml',{open(node){const type=node.attrs.ContentType;if(type&&/macro|vba|oleObject|encrypted/i.test(type))throw new P5Error('security');if(node.local==='Override'){const part=node.attrs.PartName;if(!part?.startsWith('/')||!type)fail();const path=targetPath('',part);if(contentTypes.has(path)||!contents.has(path))fail();contentTypes.set(path,type);}}},typesNs,'Types');
  if(contentTypes.get('xl/workbook.xml')!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')fail();
  type Relation={type:string;target:string;external:boolean};
  const relations=(path:string)=>{const result=new Map<string,Relation>(),base=path==='_rels/.rels'?'':path.slice(0,path.lastIndexOf('/_rels/'));scan(path,{open(node){if(node.local!=='Relationship')return;const {Id:id,Type:type,Target:target,TargetMode:mode}=node.attrs;if(!id||!type||!target||result.has(id)||mode&&mode!=='External')fail();const external=mode==='External';const normalized=external?target:targetPath(base,target);if(!external&&!contents.has(normalized))fail();result.set(id,{type,target:normalized,external});}},relsNs,'Relationships');return result;};
  const root=relations('_rels/.rels');if(![...root.values()].some(r=>r.type===`${officeNs}/officeDocument`&&r.target==='xl/workbook.xml'&&!r.external))fail();const workbookRels=relations('xl/_rels/workbook.xml.rels');
  const sheets:(XlsxEnvelope['sheets'][number]&{path:string})[]=[],sheetNames=new Set<string>();let dateSystem:'1900'|'1904'='1900';
  scan('xl/workbook.xml',{open(node,parent){if(node.local==='workbookPr'){const date=node.attrs.date1904;if(date&&!['0','1','true','false'].includes(date))fail();if(date==='1'||date==='true')dateSystem='1904';}
    if(node.local!=='sheet')return;if(parent?.local!=='sheets')fail();const id=node.attrs['r:id'],name=node.attrs.name,visibility=node.attrs.state??'visible',relation=id&&workbookRels.get(id);if(!id||!name||name.length>256||sheetNames.has(name.toLowerCase())||sheets.some(s=>s.id===id)||!['visible','hidden','veryHidden'].includes(visibility)||!relation||relation.external||relation.type!==`${officeNs}/worksheet`||contentTypes.get(relation.target)!=='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml')fail();sheetNames.add(name.toLowerCase());sheets.push({id,name,visibility:visibility as 'visible'|'hidden'|'veryHidden',lastRow:0,lastColumn:0,path:relation.target});assertLimit('xlsxSheets',sheets.length);}},sheetNs,'workbook');if(!sheets.length)fail();
  let sharedUnits=0,sharedCount=0,siUnits=0;
  if(contents.has('xl/sharedStrings.xml'))scan('xl/sharedStrings.xml',{open(node){if(node.local==='si'){sharedCount++;siUnits=0;}},text(text,parent){if(parent.local==='t'){siUnits+=text.length;sharedUnits+=text.length;assertLimit('xlsxCellUnits',siUnits);assertLimit('xlsxSharedUnits',sharedUnits);}}},sheetNs,'sst');
  let allocatedCells=0,totalCells=0;const missingFormulaCells:Record<string,string[]>=Object.create(null);
  for(const sheet of sheets){
    let declared:ReturnType<typeof range>|undefined,row=0,lastRow=0,lastColumn=0,cell:{type:string;textUnits:number;value:string;seenValue:boolean;formula:boolean;address:string}|undefined,inValue=false;const rows=new Set<number>(),cells=new Set<string>();missingFormulaCells[sheet.id]=[];
    scan(sheet.path,{open(node,parent){
      if(node.local==='dimension'){if(declared)fail();declared=range(node.attrs.ref??'');}
      if(node.local==='row'){if(parent?.local!=='sheetData'||!node.attrs.r||!/^[1-9][0-9]*$/.test(node.attrs.r))fail();row=Number(node.attrs.r);assertLimit('xlsxRows',row);if(rows.has(row))fail();rows.add(row);lastRow=Math.max(lastRow,row);}
      if(inValue)fail();
      if(node.local==='c'){if(parent?.local!=='row'||!node.attrs.r||cells.has(node.attrs.r))fail();const at=address(node.attrs.r);if(at.row!==row||declared&&(at.row<declared.start.row||at.row>declared.end.row||at.column<declared.start.column||at.column>declared.end.column))fail();cells.add(node.attrs.r);assertLimit('xlsxCells',++totalCells);lastRow=Math.max(lastRow,at.row);lastColumn=Math.max(lastColumn,at.column);const type=node.attrs.t??'n';if(!['n','s','str','inlineStr','b','e','d'].includes(type))fail();cell={type,textUnits:0,value:'',seenValue:false,formula:false,address:node.attrs.r};}
      if(node.local==='v'){if(!cell||parent?.local!=='c'||cell.seenValue)fail();inValue=true;cell.seenValue=true;}
      if(node.local==='f'){if(!cell||parent?.local!=='c'||cell.formula)fail();cell.formula=true;if(node.attrs.ref)range(node.attrs.ref);}if(node.local==='mergeCell')range(node.attrs.ref??'');
    },text(text,parent){if(cell){if(parent.local==='t'||parent.local==='v'||parent.local==='f'){cell.textUnits+=text.length;assertLimit('xlsxCellUnits',cell.textUnits);}if(inValue)cell.value+=text;}},close(node){
      if(node.local==='v')inValue=false;
      if(node.local==='c'){
        if(!cell)fail();if(cell.formula&&(!cell.seenValue||!cell.value.trim()))missingFormulaCells[sheet.id]!.push(cell.address);const value=cell.value.trim();if(value&&(cell.type==='n'||cell.type==='s')){
          if(!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value))fail();const number=Number(value);if(!Number.isFinite(number)||Number.isInteger(number)&&!Number.isSafeInteger(number))throw new P5Error('precision');if(cell.type==='s'&&(!Number.isInteger(number)||number<0||number>=sharedCount))fail();
        }else if(value&&cell.type==='b'&&!['0','1'].includes(value))fail();cell=undefined;
      }
    }},sheetNs,'worksheet');
    if(declared){lastRow=Math.max(lastRow,declared.end.row);lastColumn=Math.max(lastColumn,declared.end.column);}allocatedCells+=lastRow*lastColumn;assertLimit('xlsxCells',allocatedCells);sheet.lastRow=lastRow;sheet.lastColumn=lastColumn;
  }
  for(const path of contents.keys())if(!scanned.has(path)&&/\.(?:xml|rels)$/i.test(path)){if(path.endsWith('.rels'))relations(path);else scan(path);}
  return{markers:state.markers,sharedUnits,allocatedCells,sheets:sheets.map(({path,...sheet})=>{void path;return sheet;}),dateSystem,missingFormulaCells};
}
