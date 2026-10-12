import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {verifyFixReports} from '../../scripts/review-phase5-package.mjs';
import type {DependencyRecord} from '../../scripts/phase5-dependency-policy.mjs';
const record=():DependencyRecord=>JSON.parse(readFileSync('docs/phase5/dependencies/manifest.json','utf8')).packages.find((r:{name:string})=>r.name==='xlsx');
it('binds actual XLSX fix report to reviewed source and acquired archive',()=>{expect(verifyFixReports(process.cwd(),record())).toBe(true);});
it('rejects missing, altered or substituted report path/hash',()=>{
  for(const change of ['path','hash','source']){const r=record();if(change==='path')r.fixVerifications![0]!.regression.reportPath='../outside';if(change==='hash')r.fixVerifications![0]!.regression.reportSha256='a'.repeat(64);if(change==='source')r.fixVerifications![0]!.sourceSha256='a'.repeat(64);expect(verifyFixReports(process.cwd(),r)).toBe(false);}
});
