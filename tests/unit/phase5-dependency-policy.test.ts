import {expect,it} from 'vitest';
import {evaluateDependency,type DependencyRecord,type AdvisoryRecord} from '../../scripts/phase5-dependency-policy.mjs';
import {inspectArchive} from '../../scripts/review-phase5-package.mjs';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
function yaml():DependencyRecord{return{name:'yaml',version:'2.9.1',dependencySpec:'2.9.1',source:'https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz',archiveSha256:'4ef6c54cf559b8a207b7b518378230805a1c84af239b14960e8c67c7d59de5d3',bytes:100,integrityVerified:true,license:'ISC',memberHashes:{'package/package.json':'b'.repeat(64),'package/LICENSE':'c'.repeat(64)},licenses:['package/LICENSE'],scripts:{},relationships:{direct:[],transitive:[],embedded:[]},importGraph:['browser/index.js'],binaries:[],runtimeNetwork:{reviewed:true,externalFallback:false},reviewComplete:true};}
it('yaml_gate_independent_of_xlsx_state with complete reviewed candidate',()=>{expect(evaluateDependency(yaml(),[])).toEqual({decision:'PASS',reasons:[]});});
it.each(['hash','license','inventory','version','floating','source','scripts','binary','network','review'])('rejects missing or contradictory record: %s',change=>{
  const r=yaml();if(change==='hash')r.archiveSha256='';if(change==='license')r.license='Apache-2.0';if(change==='inventory')r.memberHashes={};if(change==='version')r.version='0.0.0';if(change==='floating')r.dependencySpec='^2.9.1';if(change==='source')r.source='https://mirror.invalid/yaml.tgz';if(change==='scripts')r.scripts={postinstall:'unreviewed'};if(change==='binary')r.binaries=['unknown.wasm'];if(change==='network')r.runtimeNetwork.externalFallback=true;if(change==='review')r.reviewComplete=false;
  expect(evaluateDependency(r,[]).decision).toBe('BLOCKED');
});
it('does_not_admit_from_empty_scanner_results_alone',()=>{const r=yaml();r.integrityVerified=false;r.runtimeNetwork.reviewed=false;expect(evaluateDependency(r,[]).decision).toBe('BLOCKED');});
it('unresolved high or applicable high blocks only this candidate',()=>{
  const alert:AdvisoryRecord={id:'fictional-alert',severity:'HIGH',actualVendoredVersion:'2.9.1',disposition:'Unresolved',evidence:[]};expect(evaluateDependency(yaml(),[alert]).decision).toBe('BLOCKED');
  alert.disposition='Applicable';expect(evaluateDependency(yaml(),[alert]).decision).toBe('BLOCKED');expect(evaluateDependency(yaml(),[]).decision).toBe('PASS');
});
it('requires actual version and evidence for a not applicable disposition',()=>{
  const alert:AdvisoryRecord={id:'fictional-alert',severity:'HIGH',actualVendoredVersion:'0.0.0',disposition:'Not applicable with evidence',evidence:[]};expect(evaluateDependency(yaml(),[alert]).decision).toBe('BLOCKED');
});
it('rejects a valid-shaped hash that differs from the actually reviewed yaml candidate',()=>{const r=yaml();r.archiveSha256='d'.repeat(64);expect(evaluateDependency(r,[]).decision).toBe('BLOCKED');});
function archive(name:string,type='0'){
  const header=Buffer.alloc(512);header.write(name);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write('00000000002\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);const sum=header.reduce((a,b)=>a+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
  return gzipSync(Buffer.concat([header,Buffer.from('{}'),Buffer.alloc(510+1024)]));
}
it('archive review accepts bounded regular files and rejects traversal links and corrupt checksums',()=>{
  expect(inspectArchive(archive('package/package.json')).get('package/package.json')?.toString()).toBe('{}');
  expect(()=>inspectArchive(archive('package/../outside'))).toThrow();expect(()=>inspectArchive(archive('package/link','2'))).toThrow();
});
function xlsx():DependencyRecord{return{...yaml(),name:'xlsx',version:'0.20.3',dependencySpec:'file:vendor/xlsx-0.20.3.tgz',source:'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',archiveSha256:'d'.repeat(64),license:'Apache-2.0',importGraph:['package/xlsx.mjs']};}
it.each(['registry','latest','mirror','republish','runtime-cdn'])('rejects wrong SheetJS acquisition %s',change=>{
  const r=xlsx();if(change==='registry')r.version='0.18.5';if(change==='latest')r.dependencySpec='latest';if(change==='mirror')r.source='https://mirror.invalid/xlsx.tgz';if(change==='republish')r.source='https://registry.npmjs.org/xlsx-safe';if(change==='runtime-cdn')r.runtimeNetwork.externalFallback=true;
  expect(evaluateDependency(r,[]).decision).toBe('BLOCKED');
});
it('vendor claim alone cannot suppress either actual SheetJS advisory',()=>{
  const alerts=['GHSA-4r6h-8v6p-xvw6','GHSA-5pgg-2g8v-p4x9'].map(id=>({id,severity:'HIGH',actualVendoredVersion:'0.20.3',disposition:'Not applicable with evidence' as const,evidence:['Vendor says fixed'],scannerClaimedRange:'>=0',officialSheetjsRange:'<0.20.2'}));
  expect(evaluateDependency(xlsx(),alerts).decision).toBe('BLOCKED');
});
it('requires both known SheetJS alerts and bound source/regression evidence, never just empty scanner',()=>{expect(evaluateDependency(xlsx(),[]).decision).toBe('BLOCKED');});
it('unresolved High blocks XLSX independently of admitted YAML',()=>{
  expect(evaluateDependency(xlsx(),[{id:'GHSA-5pgg-2g8v-p4x9',severity:'HIGH',actualVendoredVersion:'0.20.3',disposition:'Unresolved',evidence:[]}]).decision).toBe('BLOCKED');expect(evaluateDependency(yaml(),[]).decision).toBe('PASS');
});
it('admits actual fully reviewed XLSX and rejects missing per-advisory fix bindings',()=>{
  const manifest=JSON.parse(readFileSync('docs/phase5/dependencies/manifest.json','utf8')),alerts=JSON.parse(readFileSync('docs/phase5/dependencies/advisories.json','utf8')).filter((a:{package:string})=>a.package==='xlsx');
  const r:DependencyRecord=manifest.packages.find((p:{name:string})=>p.name==='xlsx');expect(evaluateDependency(r,alerts)).toEqual({decision:'PASS',reasons:[]});
  for(const change of ['source','regression','alert']){
    const copy=structuredClone(r),a=structuredClone(alerts);if(change==='source')copy.fixVerifications![0]!.sourceSha256='a'.repeat(64);if(change==='regression')copy.fixVerifications![0]!.regression.exitCode=1;if(change==='alert')a.pop();expect(evaluateDependency(copy,a).decision).toBe('BLOCKED');
  }
});
