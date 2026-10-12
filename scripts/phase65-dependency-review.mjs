import {readFile,writeFile} from 'node:fs/promises';
const current=JSON.parse(await readFile('.npm-cache/phase65-cargo-metadata.json','utf8'));
const previous=JSON.parse(await readFile('docs/phase6/dependencies/windows-metadata.json','utf8'));
const packages=current.packages.filter(p=>p.source),before=new Set(previous.packages.filter(p=>p.source).map(p=>`${p.name}@${p.version}`));
const sources=[...new Set(packages.map(p=>p.source))];
if(sources.some(s=>s!=='registry+https://github.com/rust-lang/crates.io-index'))throw Error('unexpected Cargo source');
const findings=[];
for(let i=0;i<packages.length;i+=75){const group=packages.slice(i,i+75),response=await fetch('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({queries:group.map(p=>({package:{name:p.name,ecosystem:'crates.io'},version:p.version}))})});if(!response.ok)throw Error(`OSV ${response.status}`);const body=await response.json();body.results.forEach((r,n)=>{if(r.vulns?.length)findings.push({name:group[n].name,version:group[n].version,vulns:r.vulns});});}
const report={checkedAt:new Date().toISOString(),target:'x86_64-pc-windows-msvc',packages:packages.length,addedPackages:packages.filter(p=>!before.has(`${p.name}@${p.version}`)).map(p=>`${p.name}@${p.version}`),sources,findings,licenses:packages.map(p=>({name:p.name,version:p.version,license:p.license,repository:p.repository,source:p.source})),limitations:'Dated OSV/RustSec inventory, not a vulnerability-free guarantee. No user data sent; only public package names/versions. Windows OCR runtime/model are separately recorded OS trust boundaries; not covered by Cargo or npm audit. Historical all-platform findings remain in Phase6 records.'};
await writeFile('docs/phase65/dependency-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({packages:report.packages,addedPackages:report.addedPackages,findings}));if(findings.length)process.exitCode=1;
