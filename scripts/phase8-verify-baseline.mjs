import {readFileSync,writeFileSync,mkdirSync,statSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const root='docs/phase8',base='v0.2.0-beta.3';
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex').toUpperCase();
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024});
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
mkdirSync(`${root}/validation`,{recursive:true});
const normalize=p=>path.relative(process.cwd(),p).replaceAll('\\','/');
const unitCases=x=>x.testResults.flatMap(s=>s.assertionResults.map(a=>({file:normalize(s.name),title:a.fullName,status:a.status})));
const key=x=>`${x.file}::${x.title}`;
function preserved(expected,actual){const counts=new Map();for(const c of actual)counts.set(key(c),(counts.get(key(c))??0)+1);const wanted=new Map();for(const c of expected)wanted.set(key(c),(wanted.get(key(c))??0)+1);return [...wanted].filter(([k,n])=>counts.get(k)!==n).map(([k,n])=>({case:k,expected:n,actual:counts.get(k)??0}));}
const unit=read('.npm-cache/phase8-unit.json'),accepted=read('docs/phase7/final-validation/unit.json'),baseline=read('docs/phase5/baseline.json');
const current=unitCases(unit),unitErrors=preserved(unitCases(accepted),current),phase3Errors=preserved(baseline.originalUnitCases,current);
assert.equal(unitErrors.length,0);assert.equal(phase3Errors.length,0);assert.equal(unit.numPassedTests,550);assert.equal(unit.numFailedTests+unit.numPendingTests,0);
function browserCases(report){const list=[];function visit(s){for(const spec of s.specs??[])for(const t of spec.tests)list.push({file:path.basename(spec.file??s.file),title:spec.title,project:t.projectName,results:t.results});for(const child of s.suites??[])visit(child);}for(const s of report.suites)visit(s);return list;}
const browser=read('.npm-cache/phase8-original-browser.json'),production=read('.npm-cache/phase8-phase5-production.json');
const original=browserCases(browser),prod=browserCases(production),browserErrors=preserved(baseline.originalBrowserCases,original);
const phase3=original.filter(c=>baseline.originalPhase3BrowserCases.some(b=>key(b)===key(c)));
assert.equal(browserErrors.length,0);assert.equal(phase3.length,47);
assert.equal(browser.stats.expected,90);assert.equal(production.stats.expected,44);
for(const r of[browser,production])assert.equal(r.stats.unexpected+r.stats.skipped+r.stats.flaky,0);
for(const c of[...original,...prod]){assert.equal(c.results.length,1);assert.equal(c.results[0].status,'passed');assert.equal(c.results[0].retry,0);}
const frozen=read('docs/pdf-tools/frozen-algorithms.json').map(x=>({...x,actual:hash(x.path),pass:hash(x.path)===x.expected}));assert.equal(frozen.length,16);assert.ok(frozen.every(x=>x.pass));
const changed=git('diff','--name-only',base).toString().trim().split('\n').filter(Boolean);
const protectedRoots=['src/core/','src/converters/','src/adapters/','src/workers/','src-tauri/src/','src-tauri/capabilities/','src-tauri/permissions/','tests/'];
assert.equal(changed.filter(p=>protectedRoots.some(r=>p.startsWith(r))).length,0);
const oldLock=JSON.parse(git('show',`${base}:package-lock.json`)),newLock=read('package-lock.json');
for(const l of[oldLock,newLock]){delete l.version;delete l.packages[''].version;}assert.deepEqual(newLock,oldLock);
const cargoNormalize=s=>s.replace(/(name = "fileflow-desktop"\r?\nversion = ")[^"]+("\r?\n)/,'$1APP_VERSION$2').replaceAll('\r\n','\n');
assert.equal(cargoNormalize(readFileSync('src-tauri/Cargo.lock','utf8')),cargoNormalize(git('show',`${base}:src-tauri/Cargo.lock`).toString()));
const oldConfig=JSON.parse(git('show',`${base}:src-tauri/tauri.conf.json`)),config=read('src-tauri/tauri.conf.json');assert.deepEqual(config.app,oldConfig.app);
const template=read('src-tauri/windows/template-manifest.json'),restored=readFileSync(template.local,'utf8').replace('  reinst_uninstall:\n    Call FileFlowPreflight\n    HideWindow','  reinst_uninstall:\n    HideWindow');
assert.equal(createHash('sha256').update(restored).digest('hex').toUpperCase(),template.upstreamSha256);
const archive=read(`${root}/archive.json`);assert.equal(git('rev-parse',`${base}^{commit}`).toString().trim(),archive.commit);
const binary='src-tauri/target/release/fileflow-desktop.exe',artifact='src-tauri/target/release/bundle/nsis/FileFlow_0.2.0-rc.1_x64-setup.exe';
const signature=read('.npm-cache/phase8-signature.json');assert.equal(signature.Status,2);
const installer={version:'0.2.0-rc.1',path:artifact,absolutePath:path.resolve(artifact),bytes:statSync(artifact).size,sha256:hash(artifact),hashVerified:true,signatureStatus:'NotSigned',rawAuthenticodeStatus:signature.Status,binary:{path:binary,bytes:statSync(binary).size,sha256:hash(binary)},manualAcceptance:'Pending',published:false};
const oldPackages=[['0.1.2','9558083854A77331AA2B1876F8CA84C9B4CF919DBAEDCFDA51F48653745E7EAE'],['0.2.0-beta.1','ACFB679AEE05E45555CE8D27E5D47190F2110F6BD1648637B274C843243C7591'],['0.2.0-beta.2','0D8C48CC9D7A640F99FFDC50BE635215CBEFC9D38184BD311B08487CC8535995'],['0.2.0-beta.3',archive.installerSha256]].map(([version,sha256])=>{const p=`src-tauri/target/release/bundle/nsis/FileFlow_${version}_x64-setup.exe`;assert.equal(hash(p),sha256);return{version,tag:`v${version}`,commit:git('rev-parse',`v${version}^{commit}`).toString().trim(),path:p,bytes:statSync(p).size,sha256,preserved:true};});
const baselineReport={checkedOn:'2026-10-12',unit:{passed:550,total:550,accepted550Preserved:true,originalPhase3:103,identityErrors:unitErrors,phase3Errors},browser:{original:90,phase3:47,production:44,productionProjects:prod.reduce((r,c)=>({...r,[c.project]:(r[c.project]??0)+1}),{}),retries:0,skipped:0,phase3SameRun:true,identityErrors:browserErrors},frozen,source:{baseCommit:archive.commit,changed,existingTestSourcesUnchanged:true,protectedSourcesUnchanged:true,npmLockExceptAppVersionUnchanged:true,cargoLockExceptAppVersionUnchanged:true,ipcCapabilitiesAndCspUnchanged:true,newDependencies:false,pinnedTemplateOnlyOneAddedCall:true},oldPackages};
save(`${root}/baseline-verification.json`,baselineReport);save(`${root}/installer.json`,installer);
for(const name of['unit','original-browser','phase5-production'])writeFileSync(`${root}/validation/${name}.json`,readFileSync(`.npm-cache/phase8-${name}.json`));
if(process.argv.includes('--preserve-historical-phase3-records'))for(const name of['download-permission','performance-small','performance-medium','performance-large']){const p=`docs/phase3/${name}.json`;writeFileSync(`${root}/validation/phase3-${name}.json`,readFileSync(p));writeFileSync(p,git('show',`${base}:${p}`));}
const sourceFiles=git('ls-files','src','src-tauri/src','src-tauri/capabilities','src-tauri/permissions','src-tauri/build.rs','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','package.json','package-lock.json','vite.config.ts','vite.desktop.config.ts').toString().trim().split('\n');
for(const dir of['src-tauri/windows','src-tauri/licenses'])for(const name of readdirSync(dir))sourceFiles.push(`${dir}/${name}`);
save(`${root}/source-manifest.json`,{version:installer.version,baseCommit:archive.commit,uncommittedDevelopment:true,files:[...new Set(sourceFiles)].sort().map(p=>({path:p,bytes:statSync(p).size,sha256:hash(p)}))});
const fromLatest=f=>{const l=read(f);return{evidence:l.evidence,...read(path.join(l.evidence,'results.json'))};};
const ocr=fromLatest(`${root}/desktop-e2e/latest.json`),pdf=fromLatest(`${root}/pdf-tools/webview2-latest.json`),desktop=fromLatest(`${root}/desktop-regression-latest.json`),installation=fromLatest(`${root}/installation/latest.json`);
for(const [r,n] of[[ocr,20],[pdf,14],[desktop,6],[installation,11]]){assert.equal(r.results.length,n);assert.ok(r.results.every(x=>x.status==='PASS'));}
const memory=readFileSync(path.join(ocr.evidence,'memory.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const memorySummary={samples:memory.length,maxWorkingSetBytes:Math.max(...memory.map(x=>x.totalWorkingSet)),maxPrivateBytes:Math.max(...memory.map(x=>x.totalPrivateBytes)),scope:'Sampled app/child process tree in the finite OCR run; not a total system or between-sample bound; no performance improvement claimed.'};save(`${root}/memory-observation.json`,memorySummary);
const dependencies=read(`${root}/dependency-review.json`),compliance=read(`${root}/compliance.json`),audit=read(`${root}/validation/npm-audit.json`);assert.equal(dependencies.packages,243);assert.equal(dependencies.findings.length,0);assert.equal(dependencies.addedPackages.length,0);assert.equal(audit.metadata.vulnerabilities.total,0);
const rustLog=readFileSync(`${root}/validation/rust.log`,'utf8'),rustCounts=rustLog.match(/test result: FAILED\. (\d+) passed; (\d+) failed;/);assert.ok(rustCounts);assert.equal(Number(rustCounts[1]),35);assert.equal(Number(rustCounts[2]),1);assert.match(rustLog,/fixture symlink:.*os error 5/);assert.match(rustLog,/test grants::tests::[^\r\n]*junction[^\r\n]*\.\.\. ok/);
const secretSummary=readFileSync(`${root}/validation/secrets.log`,'utf8').match(/^Secret scan: (\d+) project text files checked; 0 credential candidates\./m);assert.ok(secretSummary,'Run the actual final secrets command before collecting evidence.');
const manualPath=`${root}/manual-acceptance-result.json`;
let manual={status:'Pending',guide:`${root}/manual-acceptance.md`};
if(existsSync(manualPath)){const receipt=read(manualPath);assert.equal(receipt.version,installer.version);assert.equal(receipt.installerSha256,installer.sha256);assert.equal(receipt.guideSha256,hash(manual.guide));manual={...manual,status:receipt.status,evidence:manualPath,source:'User-reported; not independent agent observation of native dialogs or physical network state.'};installer.manualAcceptance=receipt.status;save(`${root}/installer.json`,installer);}
save(`${root}/results.json`,{checkedOn:'2026-10-12',version:installer.version,status:manual.status.startsWith('PASS')?'Personal local acceptance passed (user-reported); RC delivery complete; symbolic-link coverage gap remains; public release not ready':'Candidate ready; formal personal acceptance pending; Rust symbolic-link fixture unverified',archive,unit:baselineReport.unit,browser:baselineReport.browser,frozen:{passed:16,evidence:`${root}/baseline-verification.json`},desktop:{ocr:20,pdf:14,integration:6,finalPackageIntegration:true,scope:'Real bundled app/IPC; DOM file admission is not native picker/save acceptance.'},installation:{passed:11,total:11,evidence:installation.evidence,scope:installation.scope,cleanupStatus:installation.cleanupStatus},rust:{passed:Number(rustCounts[1]),total:36,failed:Number(rustCounts[2]),unverified:1,failure:'Fixture symbolic-link creation denied by Windows (Win32 5) before path-rejection assertions.',junctionVerified:true,existingAssertionsUnchanged:true,evidence:`${root}/validation/rust.log`},checks:{lint:true,typecheck:true,webBuild:true,desktopBuild:true,npmAudit:true,nativeAudit:true,secrets:true},secretScan:{files:Number(secretSummary[1]),credentialCandidates:0},dependencies:{npmVulnerabilities:0,nativePackages:dependencies.packages,nativeFindings:0,newDependencies:false,frontendInventory:compliance.frontend.length,pdfAssetLicenses:compliance.pdfAssetLicenses.length},manual,installer,memory:memorySummary,projectLicenseDecisionAuthorized:false,publicReleaseAuthorized:false,pushed:false,deployed:false,released:false});
console.log(JSON.stringify({unit:550,phase3Unit:103,browser:90,phase3SameRun:47,production:44,frozen:16,protectedChanges:0,installerBytes:installer.bytes,sha256:installer.sha256,rust:'35 pass / 1 fixture failure; symbolic-link assertions unverified',manual:manual.status}));
