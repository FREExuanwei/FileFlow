import {writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='docs/phase5/dependencies/raw/',records=[];
const sources={
  'xlsx-GHSA-4r6h-8v6p-xvw6.json':'https://api.osv.dev/v1/vulns/GHSA-4r6h-8v6p-xvw6',
  'xlsx-GHSA-5pgg-2g8v-p4x9.json':'https://api.osv.dev/v1/vulns/GHSA-5pgg-2g8v-p4x9',
  'xlsx-official-CVE-2023-30533.html':'https://cdn.sheetjs.com/advisories/CVE-2023-30533',
  'xlsx-official-CVE-2024-22363.html':'https://cdn.sheetjs.com/advisories/CVE-2024-22363',
  'xlsx-0.19.3-fixed.txt':'https://cdn.sheetjs.com/xlsx-0.19.3/package/xlsx.mjs',
  'xlsx-0.20.2-fixed.txt':'https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs',
  'xlsx-0.20.1-source.txt':'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs',
  'xlsx-official-LICENSE.txt':'https://cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE',
};
async function save(name,url,options){
  if(existsSync(base+name))throw new Error('Do not overwrite evidence');
  const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>4*1024**2)throw new Error('Evidence size limit');writeFileSync(base+name,bytes,{flag:'wx'});records.push({name,url,method:options?.method??'GET',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),checkedAt:new Date().toISOString()});
}
for(const [name,url] of Object.entries(sources))await save(name,url);
await save('xlsx-osv-exact.json','https://api.osv.dev/v1/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{name:'xlsx',ecosystem:'npm'},version:'0.20.3'})});
writeFileSync('docs/phase5/dependencies/xlsx-evidence-acquisition.json',JSON.stringify(records,null,2)+'\n',{flag:'wx'});
console.log(`Saved ${records.length} official evidence records; no package code executed.`);
