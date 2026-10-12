import type {P5RunContext} from '../../../core/phase5/types';
import {P5Error} from '../../../core/phase5/errors';
import {P5_LIMITS as limits,assertLimit} from '../../../core/phase5/limits';
import {analyzeXlsxXml} from './xml-preflight';
export interface XlsxEnvelope{sourceBytes:number;expandedBytes:number;entryCount:number;xmlMarkers:number;sharedStringUnits:number;numericLexemesChecked:true;sheets:readonly{id:string;name:string;lastRow:number;lastColumn:number;visibility:'visible'|'hidden'|'veryHidden'}[];dateSystem:'1900'|'1904';missingFormulaCells?:Readonly<Record<string,readonly string[]>>}
const fail=():never=>{throw new P5Error('structure');};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255]!;return(crc^0xffffffff)>>>0;}
function extra(bytes:Uint8Array){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let i=0;while(i<bytes.length){if(i+4>bytes.length)fail();const id=v.getUint16(i,true),size=v.getUint16(i+2,true);if(id===1||i+4+size>bytes.length)fail();i+=4+size;}}
export async function preflightXlsx(bytes:Uint8Array,context:Pick<P5RunContext,'signal'>):Promise<XlsxEnvelope>{
  const abort=()=>{if(context.signal.aborted)throw new P5Error('cancel');};abort();assertLimit('xlsxSource',bytes.length);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<22||view.getUint32(0,true)!==0x04034b50)fail();
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}if(end<0)fail();
  const count=view.getUint16(end+10,true),directory=view.getUint32(end+16,true),directorySize=view.getUint32(end+12,true);assertLimit('xlsxEntries',count);
  if(!count||view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||directory+directorySize!==end)fail();
  let position=directory,declared=0;const names=new Set<string>(),entries:{name:string;start:number;packed:number;size:number;method:number;crc:number}[]=[],spans:{start:number;end:number}[]=[];
  const decoder=new TextDecoder('utf-8',{fatal:true});
  for(let n=0;n<count;n++){
    abort();if(position+46>end||view.getUint32(position,true)!==0x02014b50)fail();
    const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true),crc=view.getUint32(position+16,true),packed=view.getUint32(position+20,true),size=view.getUint32(position+24,true),local=view.getUint32(position+42,true),nameLength=view.getUint16(position+28,true),extraLength=view.getUint16(position+30,true),commentLength=view.getUint16(position+32,true),next=position+46+nameLength+extraLength+commentLength;
    if(flags&~(8|2048)||method!==0&&method!==8||view.getUint16(position+6,true)>20||view.getUint16(position+34,true)||packed===0xffffffff||size===0xffffffff||local===0xffffffff||next>end||((view.getUint32(position+38,true)>>>16)&0xf000)===0xa000)fail();
    assertLimit('xlsxEntry',size);declared+=size;assertLimit('xlsxExpanded',declared);if(size/Math.max(1,packed)>limits.xlsxRatio)throw new P5Error('size');
    let name:string;try{name=decoder.decode(bytes.subarray(position+46,position+46+nameLength));}catch{throw new P5Error('utf8');}
    if(!name||name.startsWith('/')||name.includes('\\')||name.includes(':')||name.includes('%')||Array.from(name).some(c=>c.charCodeAt(0)<32)||name.split('/').some((p,i,a)=>p==='..'||p==='.'||!p&&i!==a.length-1))fail();
    const canonical=name.normalize('NFC').toLowerCase();if(names.has(canonical))fail();names.add(canonical);
    if(/vba|macros?|(?:^|\/)embeddings\//i.test(name)||/\.(?:zip|xlsx?|xls[bm]|docx|pptx|ods|bin)$/i.test(name))throw new P5Error('security');
    extra(bytes.subarray(position+46+nameLength,position+46+nameLength+extraLength));
    if(local+30>directory||view.getUint32(local,true)!==0x04034b50||view.getUint16(local+4,true)>20||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)fail();
    const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localName+localExtra;
    if(localName!==nameLength||start+packed>directory||!bytes.subarray(position+46,position+46+nameLength).every((b,i)=>bytes[local+30+i]===b))fail();extra(bytes.subarray(local+30+localName,start));
    let spanEnd=start+packed;
    if(flags&8){
      if(spanEnd+12>directory)fail();let descriptor=spanEnd;if(view.getUint32(descriptor,true)===0x08074b50)descriptor+=4;
      if(descriptor+12>directory||view.getUint32(descriptor,true)!==crc||view.getUint32(descriptor+4,true)!==packed||view.getUint32(descriptor+8,true)!==size)fail();spanEnd=descriptor+12;
      for(const [offset,value] of [[14,crc],[18,packed],[22,size]])if(view.getUint32(local+offset!,true)!==0&&view.getUint32(local+offset!,true)!==value)fail();
    }else if(view.getUint32(local+14,true)!==crc||view.getUint32(local+18,true)!==packed||view.getUint32(local+22,true)!==size)fail();
    if(name.endsWith('/')&&(size||packed))fail();spans.push({start:local,end:spanEnd});entries.push({name,start,packed,size,method,crc});position=next;
  }
  if(position!==end)fail();spans.sort((a,b)=>a.start-b.start);if(spans[0]?.start!==0||spans.at(-1)?.end!==directory||spans.some((span,i)=>i>0&&span.start!==spans[i-1]!.end))fail();
  let actual=0;const contents=new Map<string,Uint8Array>();
  for(const entry of entries){
    abort();const compressed=bytes.subarray(entry.start,entry.start+entry.packed);let data:Uint8Array;
    if(entry.method===0){if(entry.packed!==entry.size)fail();data=compressed;actual+=data.length;}
    else{
      const reader=new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks:Uint8Array[]=[];let length=0;
      const cancel=()=>{void reader.cancel().catch(()=>{});};context.signal.addEventListener('abort',cancel,{once:true});
      try{while(true){abort();const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;actual+=chunk.value.length;if(length>entry.size||length>limits.xlsxEntry||actual>limits.xlsxExpanded)throw new P5Error('size');chunks.push(chunk.value);}abort();if(length!==entry.size)fail();data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}}
      catch(error){if(error instanceof P5Error)throw error;abort();throw new P5Error('structure');}
      finally{context.signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
    }
    assertLimit('xlsxExpanded',actual);if(data.length!==entry.size||crc32(data)!==entry.crc)fail();
    if(data.length>=4&&(data[0]===80&&data[1]===75&&[3,5,7].includes(data[2]!)||data[0]===208&&data[1]===207&&data[2]===17&&data[3]===224))throw new P5Error('security');
    if(!entry.name.endsWith('/'))contents.set(entry.name,data);
  }
  const result=analyzeXlsxXml(contents,context.signal);const estimate=2*bytes.length+3*actual+96*result.allocatedCells+2*limits.xlsxOutput+8*1024**2;if(estimate>limits.xlsxTransient)throw new P5Error('budget');
  return{sourceBytes:bytes.length,expandedBytes:actual,entryCount:count,xmlMarkers:result.markers,sharedStringUnits:result.sharedUnits,numericLexemesChecked:true,sheets:result.sheets,dateSystem:result.dateSystem,missingFormulaCells:result.missingFormulaCells};
}
