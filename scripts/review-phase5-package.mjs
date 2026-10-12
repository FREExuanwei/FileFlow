import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {evaluateDependency} from './phase5-dependency-policy.mjs';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyFixReports(root,record){
  if(record.name!=='xlsx')return true;
  try{
    if(record.fixVerifications?.length!==2)return false;
    return record.fixVerifications.every(proof=>{
      const regression=proof.regression;if(regression?.reportPath!=='docs/phase5/validation/task-09/security-regression.json'||regression.command!=='node scripts/phase5-xlsx-security-regression.mjs'||regression.exitCode!==0)return false;
      const bytes=readFileSync(resolve(root,regression.reportPath));if(sha256(bytes)!==regression.reportSha256)return false;
      const result=JSON.parse(bytes);return result.pass===true&&result.decision==='PASS'&&result.sourceSha256===proof.sourceSha256&&record.memberHashes?.[proof.sourcePath]===proof.sourceSha256&&result.archiveSha256===record.archiveSha256&&result.prototypePositiveControl===true&&result.prototypeGuard===true&&result.prototypeRefs?.length===3&&result.fixedRegexLines?.length===16&&result.isolated===true&&result.timeoutMs===10000&&result.memoryLimitMb===128;
    });
  }catch{return false;}
}
export function inspectArchive(bytes){
  const tar=gunzipSync(bytes,{maxOutputLength:32*1024**2}),members=new Map();let offset=0,ended=false;
  while(offset+512<=tar.length){const header=tar.subarray(offset,offset+512);if(header.every(byte=>byte===0)){ended=true;break;}
    const field=(start,length)=>header.subarray(start,start+length).toString('utf8').replace(/\0.*$/s,'');
    const octal=value=>{if(!/^[0-7]+\s*$/.test(value))throw new Error('Unsupported tar number');return parseInt(value,8);};
    const size=octal(field(124,12)),checksum=octal(field(148,8));let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:header[i];if(sum!==checksum)throw new Error('Tar header checksum mismatch');
    const prefix=field(345,155),name=(prefix?prefix+'/':'')+field(0,100),type=field(156,1);
    if(!name.startsWith('package/')||name.includes('\\')||name.split('/').some(part=>part==='..'||part==='.')||name.includes(':')||Array.from(name).some(char=>char.charCodeAt(0)<32)||members.has(name))throw new Error('Unsafe or duplicate tar path');
    if(type!==''&&type!=='0'&&type!=='5')throw new Error('Unsupported tar link or extension');
    if(!Number.isSafeInteger(size)||size<0||size>8*1024**2||offset+512+size>tar.length||members.size>=2048)throw new Error('Tar safety limit');
    if(type!=='5')members.set(name,tar.subarray(offset+512,offset+512+size));offset+=512+Math.ceil(size/512)*512;
  }
  if(!ended||tar.subarray(offset).some(byte=>byte!==0))throw new Error('Missing tar end marker');return members;
}
async function download(url,maxBytes){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status} at approved origin`);
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('Acquisition size limit');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
  return Buffer.concat(chunks);
}
const candidates={yaml:{version:'2.9.1',source:'https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz',metadata:'https://registry.npmjs.org/yaml/2.9.1'},xlsx:{version:'0.20.3',source:'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',metadata:'https://cdn.sheetjs.com/xlsx-0.20.3/package/package.json'}};
async function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),arg=name=>process.argv[process.argv.indexOf(name)+1],name=arg('--package'),version=arg('--version'),candidate=candidates[name];
  if(!candidate||version!==candidate.version)throw new Error('Candidate not admitted for acquisition');
  const archivePath=resolve(root,arg('--archive')),expected=resolve(root,`vendor/${name}-${version}.tgz`);if(archivePath!==expected)throw new Error('Archive must use the approved local path');
  const directory=resolve(root,'docs/phase5/dependencies'),raw=resolve(directory,'raw');mkdirSync(raw,{recursive:true});mkdirSync(dirname(archivePath),{recursive:true});
  if(process.argv.includes('--acquire')){
    if(existsSync(archivePath))throw new Error('Never overwrite an acquired archive');
    const metadataBytes=await download(candidate.metadata,2*1024**2),metadata=JSON.parse(metadataBytes);
    if(metadata.name!==name||metadata.version!==version||metadata.license!==(name==='yaml'?'ISC':'Apache-2.0'))throw new Error('Official metadata identity mismatch');
    if(name==='yaml'&&(metadata.dist?.tarball!==candidate.source||metadata.gitHead!=='1440ecd3d1bff41e4ac399f8f6839e810328bd16'))throw new Error('Official yaml metadata identity mismatch');
    writeFileSync(resolve(raw,`${name}-metadata.json`),metadataBytes);
    const bytes=await download(candidate.source,16*1024**2),integrity=`sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    if(name==='yaml'&&(integrity!==metadata.dist.integrity||integrity!=='sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw=='))throw new Error('Archive SRI mismatch');
    const archiveMembers=inspectArchive(bytes),archiveMetadata=JSON.parse(archiveMembers.get('package/package.json').toString('utf8'));
    if(archiveMetadata.name!==name||archiveMetadata.version!==version||archiveMetadata.license!==metadata.license)throw new Error('Archive metadata mismatch');
    if(name==='xlsx'&&JSON.stringify(archiveMetadata)!==JSON.stringify(metadata))throw new Error('SheetJS archive/CDN metadata mismatch');
    writeFileSync(archivePath,bytes,{flag:'wx'});
    writeFileSync(resolve(directory,`${name}-acquisition.json`),JSON.stringify({name,version,source:candidate.source,metadataSource:candidate.metadata,acquiredAt:new Date().toISOString(),archiveSha256:sha256(bytes),bytes:bytes.length,integrity,integrityVerified:true,publisherDigestVerified:name==='yaml',installed:false,decision:'PENDING_REVIEW'},null,2)+'\n',{flag:'wx'});
  }
  const bytes=readFileSync(archivePath),acquisition=JSON.parse(readFileSync(resolve(directory,`${name}-acquisition.json`),'utf8'));
  if(sha256(bytes)!==acquisition.archiveSha256||bytes.length!==acquisition.bytes)throw new Error('Archive differs from first acquisition');
  const members=inspectArchive(bytes),pkg=JSON.parse(members.get('package/package.json').toString('utf8'));
  const inventory={name,version,package:pkg,acquisition,members:[...members].map(([path,value])=>({path,bytes:value.length,sha256:sha256(value)})),binaries:[...members.keys()].filter(path=>/\.(?:wasm|dll|exe|node|so|bin|dat|gz)$/i.test(path)),runtimeSources:[...members.keys()].filter(path=>path.startsWith('package/browser/')&&path.endsWith('.js'))};
  writeFileSync(resolve(directory,`${name}-inventory.json`),JSON.stringify(inventory,null,2)+'\n');
  const manifestPath=resolve(directory,'manifest.json');if(!existsSync(manifestPath)){console.log(JSON.stringify({inventory:inventory.members.length,decision:'PENDING_REVIEW',installed:false}));return;}
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),record=manifest.packages.find(item=>item.name===name),advisories=JSON.parse(readFileSync(resolve(directory,'advisories.json'),'utf8')).filter(item=>item.package===name);
  if(!record){console.log(JSON.stringify({inventory:inventory.members.length,decision:'PENDING_REVIEW',installed:false}));return;}
  if(record.archiveSha256!==sha256(bytes)||record.bytes!==bytes.length||JSON.stringify(record.memberHashes)!==JSON.stringify(Object.fromEntries(inventory.members.map(member=>[member.path,member.sha256]))))throw new Error('Review not bound to actual archive inventory');
  const gate=evaluateDependency(record,advisories);if(!verifyFixReports(root,record)){gate.decision='BLOCKED';gate.reasons.push('Fix report file binding failed');}console.log(JSON.stringify(gate));process.exitCode=gate.decision==='PASS'?0:1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
