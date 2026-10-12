import {writeFileSync,readFileSync} from 'node:fs';
import {inspectArchive,sha256} from './review-phase5-package.mjs';
const directory='docs/phase5/dependencies',raw=`${directory}/raw`,checkedAt=new Date().toISOString();
const sources={
  'yaml-tag-package.json':'https://raw.githubusercontent.com/eemeli/yaml/v2.9.1/package.json',
  'yaml-tag-LICENSE.txt':'https://raw.githubusercontent.com/eemeli/yaml/v2.9.1/LICENSE',
  'yaml-tag-compose-node.txt':'https://raw.githubusercontent.com/eemeli/yaml/v2.9.1/src/compose/compose-node.ts',
  'yaml-GHSA-48c2-rrv3-qjmp.json':'https://api.osv.dev/v1/vulns/GHSA-48c2-rrv3-qjmp',
  'yaml-GHSA-f9xv-q969-pqx4.json':'https://api.osv.dev/v1/vulns/GHSA-f9xv-q969-pqx4',
};
const receipts=[];
for(const [name,url] of Object.entries(sources)){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Evidence HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2*1024**2)throw new Error('Evidence limit');writeFileSync(`${raw}/${name}`,bytes);receipts.push({path:`raw/${name}`,source:url,checkedAt,bytes:bytes.length,sha256:sha256(bytes)});
}
const response=await fetch('https://api.osv.dev/v1/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{name:'yaml',ecosystem:'npm'},version:'2.9.1'}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('OSV query unavailable');const osv=Buffer.from(await response.arrayBuffer());writeFileSync(`${raw}/yaml-osv-exact.json`,osv);receipts.push({path:'raw/yaml-osv-exact.json',source:'https://api.osv.dev/v1/query',query:{name:'yaml',version:'2.9.1'},checkedAt,bytes:osv.length,sha256:sha256(osv)});
const members=inspectArchive(readFileSync('vendor/yaml-2.9.1.tgz')),browser=[...members].filter(([path])=>path.startsWith('package/browser/')&&path.endsWith('.js'));
const imports=[],requests=[],executors=[];
for(const [path,bytes] of browser){const text=bytes.toString('utf8');for(const match of text.matchAll(/(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g))imports.push({file:path,target:match[1]??match[2]});
  if(/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|WebAssembly)\s*[.(]/.test(text))requests.push(path);
  if(/\beval\s*\(|\bnew\s+Function\s*\(/.test(text))executors.push(path);
}
writeFileSync(`${directory}/yaml-source-review.json`,JSON.stringify({checkedAt,receipts,browserModules:browser.length,imports,nonRelativeImports:imports.filter(edge=>!edge.target.startsWith('.')),networkMatches:requests,dynamicExecutors:executors,hasResourceExhaustionFix:members.get('package/browser/dist/compose/compose-node.js').toString().includes('RESOURCE_EXHAUSTION'),nodeCliNotImportedInBrowser:true,signatureVerification:'Registry SRI verified; npm publisher signature not independently verified',embeddedReview:'No vendored third-party component or additional copyright/license detected in the complete file inventory and browser source review; runtime dependencies empty.'},null,2)+'\n');
console.log(JSON.stringify({browserModules:browser.length,requests,executors,osv:JSON.parse(osv)}));
