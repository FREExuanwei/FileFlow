import {workerData,parentPort} from 'node:worker_threads';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
// Candidate code runs only in this bounded, isolated supply-chain test process.
const XLSX=await import(`data:text/javascript;base64,${Buffer.from(workerData.source).toString('base64')}`);
try{
  assert.equal(XLSX.version,'0.20.3');const wb=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([['Fictional'],[42]]);sheet.A1.c=[{a:'Fictional author',t:'Bounded fictional comment'}];XLSX.utils.book_append_sheet(wb,sheet,'Fictional');
  const control=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:false});assert.equal(XLSX.read(control,{type:'array'}).Sheets.Fictional.A1.c[0].t,'Bounded fictional comment');
  const checks=[];
  for(const ref of ['__proto__','constructor','prototype']){
    const zip=XLSX.CFB.read(new Uint8Array(control),{type:'array'});const index=zip.FullPaths.findIndex(path=>path.endsWith('xl/comments1.xml'));assert(index>=0);
    const entry=zip.FileIndex[index],xml=Buffer.from(entry.content).toString('utf8');assert(xml.includes('ref="A1"'));entry.content=Buffer.from(xml.replace('ref="A1"',`ref="${ref}"`));entry.size=entry.content.length;
    const crafted=XLSX.CFB.write(zip,{fileType:'zip',type:'array'}),before=Object.getOwnPropertyDescriptors(Object.prototype);const result=XLSX.read(crafted,{type:'array'});
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype),before);assert.equal(result.Sheets.Fictional.A2.v,42);assert.equal(result.Sheets.Fictional.A1.c,undefined);checks.push(ref);
  }
  const timings=[];
  for(const length of [1024,4096,16384]){
    const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Fictional"><Table><Row><Cell><Data ss:Type="String">fictional</Data></Cell></Row></Table></Worksheet>'+'<x a="'.repeat(Math.ceil(length/6))+'</Workbook>';
    const start=performance.now();try{XLSX.read(xml,{type:'string',dense:true,cellHTML:false});}catch{/* Closed malformed XML failure is allowed; time/memory are bounded. */}
    timings.push({inputBytes:Buffer.byteLength(xml),elapsedMs:Math.round(performance.now()-start)});
  }
  parentPort.postMessage({pass:true,prototypePositiveControl:true,prototypeRefs:checks,redOsMalformedXml:timings});
}catch(error){parentPort.postMessage({pass:false,message:error.message});}
