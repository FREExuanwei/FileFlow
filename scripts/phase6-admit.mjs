import {createHash,verify} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const out='docs/phase6/dependencies/admission';await mkdir(out,{recursive:true});
const records=[];
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const keys=await json('https://registry.npmjs.org/-/npm/v1/keys');
for(const name of ['@tauri-apps/api','@tauri-apps/cli','@tauri-apps/cli-win32-x64-msvc']){
 const p=await json(`https://registry.npmjs.org/${encodeURIComponent(name)}/2.12.1`);
 const archive=Buffer.from(await (await fetch(p.dist.tarball)).arrayBuffer());
 const integrity='sha512-'+createHash('sha512').update(archive).digest('base64');if(integrity!==p.dist.integrity)throw Error('SRI');
 const signatures=p.dist.signatures.map(s=>{const key=keys.keys.find(k=>k.keyid===s.keyid);if(!key)return {keyid:s.keyid,verified:false};return {keyid:s.keyid,verified:verify('sha256',Buffer.from(`${name}@${p.version}:${p.dist.integrity}`),`-----BEGIN PUBLIC KEY-----\n${key.key}\n-----END PUBLIC KEY-----`,Buffer.from(s.sig,'base64'))};});
 if(!signatures.some(s=>s.verified))throw Error('signature verification failed');
 await writeFile(`${out}/${name.split('/').at(-1)}-${p.version}.json`,JSON.stringify(p,null,2)+'\n');
 records.push({ecosystem:'npm',name,version:p.version,source:p.dist.tarball,license:p.license,bytes:archive.length,sha256:createHash('sha256').update(archive).digest('hex'),integrity,signatures,role:name.includes('cli')?'build-only':'runtime'});
}
for(const [name,version] of [['tauri','2.12.1'],['tauri-build','2.7.1'],['webview2-com','0.39.1'],['windows','0.62.2'],['serde','1.0.228'],['uuid','1.23.1']]){
 const index=await (await fetch(`https://index.crates.io/${name.slice(0,2)}/${name.slice(2,4)}/${name}`)).text();
 const p=index.trim().split('\n').map(line=>JSON.parse(line)).find(p=>p.vers===version);if(!p||p.yanked)throw Error(`unavailable version ${name}@${version}`);
 const archive=Buffer.from(await (await fetch(`https://static.crates.io/crates/${name}/${name}-${version}.crate`)).arrayBuffer());
 const sha256=createHash('sha256').update(archive).digest('hex');if(sha256!==p.cksum)throw Error('crate checksum');
 await writeFile(`${out}/${name}-${version}.index.json`,JSON.stringify(p,null,2)+'\n');
 records.push({ecosystem:'cargo',name,version,license:'see exact archive LICENSE and Cargo manifest',source:`https://static.crates.io/crates/${name}/${name}-${version}.crate`,sha256,bytes:archive.length,role:name==='tauri-build'?'build-only':'runtime'});
}
await writeFile(`${out}/direct.json`,JSON.stringify({checkedAt:new Date().toISOString(),records,transitiveStatus:'must review resolved Cargo.lock before product build; no safety conclusion from npm audit alone'},null,2)+'\n');console.log(records.map(p=>`${p.name}@${p.version}: ${p.sha256}`).join('\n'));
