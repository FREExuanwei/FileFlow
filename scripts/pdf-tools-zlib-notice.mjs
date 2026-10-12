import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inspectArchive} from './review-phase5-package.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),manifestPath='docs/pdf-tools/dependencies/manifest.json',manifest=JSON.parse(readFileSync(manifestPath,'utf8')),pako=manifest.packages.find(record=>record.name==='pako');
const bytes=readFileSync('.npm-cache/pdf-tools-supplychain/pako-1.0.11.tgz');assert.equal(hash(bytes),pako.archiveSha256);
const tar=gunzipSync(bytes,{maxOutputLength:32*1024**2}),head=tar.subarray(0,512),root=head.subarray(0,100).toString().replace(/\0.*$/s,'');
if(root==='package'){assert.equal(head[156],53);assert.equal(parseInt(head.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8),0);}
const members=inspectArchive(root==='package'?gzipSync(tar.subarray(512)):bytes),source=members.get('package/lib/zlib/inflate.js');assert.ok(source);
const text=source.toString(),start=text.indexOf('// (C) 1995-2013'),end=text.indexOf('\nvar utils');assert.ok(start>=0&&end>start);
const license=text.slice(start,end).split('\n').map(line=>line.replace(/^\/\/ ?/,'')).join('\n').trim()+'\n',file='docs/pdf-tools/dependencies/licenses/pako-ZLIB.txt';writeFileSync(file,license);
pako.additionalLicense={license:'Zlib',sourceMember:'package/lib/zlib/inflate.js',sourceSha256:hash(source),file,textSha256:hash(license)};writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const noticePath='docs/pdf-tools/dependencies/NOTICE.txt',notice=readFileSync(noticePath,'utf8');if(!notice.includes('Zlib component attribution'))writeFileSync(noticePath,notice+'\nZlib component attribution (pako 1.0.11):\n'+license);
console.log('Verified pinned pako archive; retained original Zlib copyright and terms in packaged NOTICE/license.');
