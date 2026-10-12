import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const records=[];
for(const [name,version] of [['cfb','1.2.2'],['crc-32','1.2.0'],['ssf','0.11.2'],['codepage','1.15.0']]){
  for(const kind of ['metadata','osv']){
    const url=kind==='metadata'?`https://registry.npmjs.org/${name}/${version}`:'https://api.osv.dev/v1/query',options=kind==='metadata'?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{name,ecosystem:'npm'},version})};
    const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1024**2)throw new Error('Evidence limit');const path=`docs/phase5/dependencies/raw/xlsx-embedded-${name}-${kind}.json`;writeFileSync(path,bytes,{flag:'wx'});records.push({name,version,kind,url,path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),checkedAt:new Date().toISOString()});
  }
}
writeFileSync('docs/phase5/dependencies/xlsx-embedded-evidence.json',JSON.stringify(records,null,2)+'\n',{flag:'wx'});console.log(`Saved${records.length} embedded provenance/scans; no dependencies installed.`);
