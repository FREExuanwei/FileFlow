import {readFile,writeFile} from 'node:fs/promises';
const base='docs/phase6/dependencies/',m=JSON.parse(await readFile(base+'cargo-metadata.json','utf8'));
const packages=m.packages.filter(p=>p.source);
const sources=[...new Set(packages.map(p=>p.source))];if(sources.some(s=>s!=='registry+https://github.com/rust-lang/crates.io-index'))throw Error('unexpected registry');
const findings=[];
for(let i=0;i<packages.length;i+=75){const group=packages.slice(i,i+75);const response=await fetch('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({queries:group.map(p=>({package:{name:p.name,ecosystem:'crates.io'},version:p.version}))})});if(!response.ok)throw Error('OSV '+response.status);const b=await response.json();b.results.forEach((r,n)=>{if(r.vulns?.length)findings.push({name:group[n].name,version:group[n].version,vulns:r.vulns});});}
const licenses=packages.map(p=>({name:p.name,version:p.version,license:p.license,licenseFile:p.license_file,repository:p.repository,source:p.source,manifest:p.manifest_path}));
const result={checkedAt:new Date().toISOString(),count:packages.length,sources,findings,licenses,limitations:'OSV/RustSec advisory inventory plus source/license review; absence of advisory is not proof of absence of vulnerabilities. Windows proprietary WebView2 Runtime is independently reviewed.'};
await writeFile(base+'cargo-review.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({count:packages.length,findings}));if(findings.length)process.exitCode=1;
