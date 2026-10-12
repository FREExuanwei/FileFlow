import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluateDependency} from './phase5-dependency-policy.mjs';
import {inspectArchive,sha256,verifyFixReports} from './review-phase5-package.mjs';
import {compareInstalledLock} from './verify-phase5-install.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
export function verifyDependencies(root){
  const manifest=read(join(root,'docs/phase5/dependencies/manifest.json')),advisories=read(join(root,'docs/phase5/dependencies/advisories.json')),lock=read(join(root,'package-lock.json')),errors=[],packages=[];
  for(const record of manifest.packages){
    const review=evaluateDependency(record,advisories.filter(a=>a.package===record.name));if(review.decision!=='PASS')errors.push(...review.reasons);
    const bytes=readFileSync(join(root,`vendor/${record.name}-${record.version}.tgz`)),members=inspectArchive(bytes);if(sha256(bytes)!==record.archiveSha256||bytes.length!==record.bytes)errors.push(`${record.name}: archive mismatch`);
    if(members.size!==Object.keys(record.memberHashes).length)errors.push(`${record.name}: member count mismatch`);
    for(const [path,value] of members){if(record.memberHashes[path]!==sha256(value))errors.push(`${record.name}: unreviewed member ${path}`);const installed=join(root,'node_modules',record.name,path.slice('package/'.length));if(!existsSync(installed)||sha256(readFileSync(installed))!==sha256(value))errors.push(`${record.name}: installed member mismatch ${path}`);}
    const entry=lock.packages[`node_modules/${record.name}`];if(entry?.version!==record.version||entry.resolved!==`file:vendor/${record.name}-${record.version}.tgz`||entry.integrity!==record.integrity)errors.push(`${record.name}: lock mismatch`);
    if(!verifyFixReports(root,record))errors.push(`${record.name}: missing bound fix evidence`);
    for(const path of record.licenses)if(!members.has(path))errors.push(`${record.name}: missing license`);
    packages.push({name:record.name,version:record.version,source:record.source,sha256:sha256(bytes),bytes:bytes.length,license:record.license,checkedMembers:members.size,decision:review.decision});
  }
  const beforeYaml=read(join(root,'docs/phase5/dependencies/pre-yaml-lock.json')),yamlOnly=JSON.parse(JSON.stringify(lock));delete yamlOnly.packages['node_modules/xlsx'];delete yamlOnly.packages[''].dependencies.xlsx;
  errors.push(...compareInstalledLock(beforeYaml,yamlOnly,'yaml'),...compareInstalledLock(read(join(root,'docs/phase5/dependencies/pre-xlsx-lock.json')),lock,'xlsx'));
  const notice=join(root,'docs/phase5/dependencies/NOTICE');if(!existsSync(notice)||!['yaml','SheetJS'].every(name=>readFileSync(notice,'utf8').includes(name)))errors.push('Missing dependency NOTICE attribution');
  const apache=readFileSync(join(root,'docs/phase5/dependencies/licenses/xlsx-Apache-2.0.txt'),'utf8').trim();for(const path of ['docs/phase5/dependencies/NOTICE','public/THIRD_PARTY_NOTICES.txt'])if(!readFileSync(join(root,path),'utf8').includes(apache))errors.push(`${path}: full Apache license missing`);
  return{packages,errors,decision:errors.length?'BLOCKED':'PASS',note:'No new network acquisition. Historical advisory dispositions retained individually; native/WASM OCR is not shipped.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const report=verifyDependencies(process.cwd());console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;}
