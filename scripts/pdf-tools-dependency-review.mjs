import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import ts from 'typescript';
import {inspectArchive} from './review-phase5-package.mjs';
const root='docs/pdf-tools/dependencies';mkdirSync(root+'/licenses',{recursive:true});
const candidate=JSON.parse(readFileSync('.npm-cache/pdf-tools-supplychain/candidates.json','utf8'));
assert.ok(candidate.security.results.every(r=>!r.vulns?.length));
const packages=[];for(const p of candidate.reports){
 const response=await fetch(p.dist.tarball);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length<8*1024**2);
 const integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');assert.equal(integrity,p.dist.integrity);
 // Canonical older npm archives include a harmless zero-byte package root
 // directory. Remove only that exact directory header for the existing strict
 // inventory parser; acquired bytes/SRI/SHA remain unchanged. No extraction.
 const tar=gunzipSync(bytes,{maxOutputLength:32*1024**2}),head=tar.subarray(0,512);
 const name=head.subarray(0,100).toString().replace(/\0.*$/s,'');let normalized=bytes;
 if(name==='package'){assert.equal(head[156],53);assert.equal(parseInt(head.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8),0);let sum=0;for(let n=0;n<512;n++)sum+=n>=148&&n<156?32:head[n];assert.equal(sum,parseInt(head.subarray(148,156).toString().replace(/\0.*$/s,'').trim(),8));normalized=gzipSync(tar.subarray(512));}
 const members=inspectArchive(normalized),metadata=JSON.parse(members.get('package/package.json'));assert.equal(metadata.name,p.name);assert.equal(metadata.version,p.version);assert.equal(metadata.license,p.license);
 assert.ok(!['preinstall','install','postinstall'].some(k=>metadata.scripts?.[k]));
 const licenseFiles=[...members.keys()].filter(n=>/\/LICENSE[^/]*$|\/license[^/]*$|\/CopyrightNotice\.txt$|\/copyright$/.test(n));assert.ok(licenseFiles.length);
 const network=[],executors=[],binaries=[];for(const [name,data]of members){if(/\.(wasm|node|dll|exe)$/i.test(name))binaries.push(name);if(/\.(?:mjs|js)$/.test(name)&&/package\/(?:es|lib|dist)\//.test(name)&&!/\.min\.js$/.test(name)){const tree=ts.createSourceFile(name,data.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const visit=node=>{if(ts.isCallExpression(node)||ts.isNewExpression(node)){const expression=node.expression,label=ts.isIdentifier(expression)?expression.text:ts.isPropertyAccessExpression(expression)?expression.name.text:'';if(['fetch','XMLHttpRequest','WebSocket'].includes(label))network.push(name);if(['eval','Function'].includes(label))executors.push(name);}ts.forEachChild(node,visit);};visit(tree);}}
 assert.deepEqual(network,[]);assert.deepEqual(executors,[]);assert.deepEqual(binaries,[]);
 const label=p.name.replaceAll('/','-').replace('@','');for(const f of licenseFiles)writeFileSync(root+'/licenses/'+label+'-'+f.split('/').at(-1)+'.txt',members.get(f));
 writeFileSync('.npm-cache/pdf-tools-supplychain/'+label+'-'+p.version+'.tgz',bytes);
 packages.push({...p,relationship:p.name==='pdf-lib'?'direct':'transitive',archiveBytes:bytes.length,archiveSha256:createHash('sha256').update(bytes).digest('hex'),registryIntegrityVerified:true,archiveMetadataVerified:true,licenseFiles,staticNetworkMatches:network,dynamicExecutors:executors,binaries,memberCount:members.size});
}
const record={checkedAt:new Date().toISOString(),decision:'PASS — scoped candidate admission before install',installed:false,packages,osv:candidate.security,limitations:['Canonical pdf-lib1.17.1 is an older release, not claimed actively maintained.','Registry HTTPS/SRI/SHA bind acquired bytes; no independent publisher signature or reproducible build attestation verified.','No known OSV findings is not proof of complete parser safety. Use terminable Worker, capped inputs/pages/results and explicit static-content export scope.','No native/WASM/model binaries introduced; Windows diagnostic boundaries remain accepted Gatev3.'],sources:['https://github.com/Hopding/pdf-lib','https://github.com/Hopding/pdf-lib/security','https://pdf-lib.js.org/docs/api/classes/pdfdocument','https://api.osv.dev/v1/querybatch']};
writeFileSync(root+'/manifest.json',JSON.stringify(record,null,2));writeFileSync(root+'/NOTICE.txt',packages.map(p=>p.name+' '+p.version+' — '+p.license+'\nSource: '+p.dist.tarball+'\nSHA256: '+p.archiveSha256+'\nFull licenses retained in licenses/. No upstream source modifications.\n').join('\n'));
console.log(JSON.stringify({decision:record.decision,packages:packages.map(p=>({name:p.name,version:p.version,archiveBytes:p.archiveBytes,sha256:p.archiveSha256,license:p.license}))}));
