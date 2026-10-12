import {readFileSync,writeFileSync,copyFileSync,mkdirSync,statSync,readdirSync,existsSync} from 'node:fs';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {browserCases,validateBrowserBaseline,validateCaseIdentities,validateSealedBaseline} from './phase5-regression.mjs';
const root='docs/pdf-tools',final=`${root}/final-validation`;mkdirSync(final,{recursive:true});
const read=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')),hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase();
const original=read('docs/phase5/baseline.json');assert.deepEqual(validateSealedBaseline(original),[]);
const units=read('.npm-cache/pdf-tools-unit-final.json'),accepted=read('docs/phase65/final-validation/unit.json');
assert.equal(units.numTotalTests,540);assert.equal(units.numPassedTests,540);assert.equal(units.numFailedTests,0);assert.equal(units.numPendingTests,0);
const cases=report=>report.testResults.flatMap(file=>file.assertionResults.map(test=>({file:basename(file.name),title:test.fullName,status:test.status})));
const acceptedCases=cases(accepted),allCases=cases(units),key=item=>`${item.file}\0${item.title}`,oldKeys=new Set(acceptedCases.map(key));
const oldCases=allCases.filter(item=>oldKeys.has(key(item)));assert.equal(oldCases.length,504);assert.ok(oldCases.every(item=>item.status==='passed'));
// Parameterized baseline tests legitimately share titles; preserve every occurrence.
assert.deepEqual(oldCases.map(key).sort(),acceptedCases.map(key).sort());
const originalFiles=new Set(original.originalUnitFiles.map(file=>basename(file))),originalUnits=allCases.filter(item=>originalFiles.has(item.file));assert.equal(originalUnits.length,103);assert.deepEqual(validateCaseIdentities(originalUnits,original.originalUnitCases),[]);
const browser=read('.npm-cache/pdf-tools-original-browser.json'),browserRecords=browserCases(browser,'pdf-tools-final-original');assert.equal(browser.stats.expected,90);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.flaky,0);assert.deepEqual(validateCaseIdentities(browserRecords,original.originalBrowserCases),[]);
const phase3=validateBrowserBaseline(browserRecords,original.originalPhase3BrowserCases);assert.deepEqual(phase3.errors,[]);
const p5=read('.npm-cache/pdf-tools-phase5-production.json');assert.equal(p5.stats.expected,44);assert.equal(p5.stats.unexpected,0);assert.equal(p5.stats.skipped,0);assert.equal(p5.stats.flaky,0);
const currentP5=browserCases(p5,'pdf-tools-p5'),acceptedP5=browserCases(read('docs/phase65/final-validation/phase5-production.json'),'accepted-p5');
assert.deepEqual([...new Set(currentP5.map(item=>item.project))].sort(),['chrome','edge']);
for(const project of ['edge','chrome']){const actual=currentP5.filter(item=>item.project===project),expected=acceptedP5.filter(item=>item.project===project);assert.equal(actual.length,22);assert.ok(actual.every(item=>item.status==='passed'&&item.attempts===1&&item.retry===0));assert.deepEqual(validateCaseIdentities(actual,expected),[]);}
const frozen=read('docs/phase65/frozen-algorithms.json').map(item=>({...item,actual:hash(item.path),pass:hash(item.path)===item.expected}));assert.equal(frozen.length,16);assert.ok(frozen.every(item=>item.pass));
const snapshot=read(`${root}/baseline.json`),allowed=new Set(['src/app/App.tsx','src/components/WorkspaceModes.tsx','src/i18n/en.ts','src/i18n/zh-CN.ts','src/i18n/phase3.ts','src/i18n/engine-messages.ts','vite.config.ts','package.json','package-lock.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json']);
const changes=snapshot.sourceFiles.filter(item=>hash(item.path).toLowerCase()!==item.sha256.toLowerCase()).map(item=>item.path);assert.ok(changes.every(file=>allowed.has(file)),`Unexpected accepted-source changes: ${changes.filter(file=>!allowed.has(file))}`);
const before=read(`${snapshot.snapshotDirectory}/package.json`),current=read('package.json');for(const[name,version]of Object.entries(before.dependencies))assert.equal(current.dependencies[name],version);assert.deepEqual(Object.keys(current.dependencies).filter(name=>!(name in before.dependencies)),['pdf-lib']);
const oldLock=read(`${snapshot.snapshotDirectory}/package-lock.json`),lock=read('package-lock.json');for(const[name,record]of Object.entries(oldLock.packages)){if(!name)continue;assert.equal(lock.packages[name]?.version,record.version);assert.equal(lock.packages[name]?.integrity,record.integrity);}const addedLock=Object.keys(lock.packages).filter(name=>!(name in oldLock.packages));
const nativeUnchanged=snapshot.sourceFiles.filter(item=>item.path.startsWith('src-tauri/src/')).every(item=>hash(item.path).toLowerCase()===item.sha256.toLowerCase());assert.ok(nativeUnchanged);
const evidence={};for(const channel of['edge','chrome','webview2']){const latest=read(`${root}/${channel}-latest.json`),report=read(`${latest.evidence}/results.json`);assert.equal(report.results.length,14);assert.ok(report.results.every(test=>test.status==='PASS'));evidence[channel]={...latest,scope:report.scope};}
const smoke=read(`${root}/desktop-regression-latest.json`),smokeReport=read(`${smoke.evidence}/results.json`);assert.equal(smokeReport.results.length,6);assert.ok(smokeReport.results.every(test=>test.status==='PASS'));
for(const file of ['download-permission.json','performance-small.json','performance-medium.json','performance-large.json']){const target=`docs/phase3/${file}`,preserved=`${final}/phase3-${file}`;if(!existsSync(preserved))copyFileSync(target,preserved);writeFileSync(target,execFileSync('git',['show',`v0.1.2:${target}`],{maxBuffer:8*1024**2}));}
for(const[from,to]of[
 ['.npm-cache/pdf-tools-unit-final.json','unit.json'],['.npm-cache/pdf-tools-original-browser.json','original-browser.json'],['.npm-cache/pdf-tools-phase5-production.json','phase5-production.json'],['.npm-cache/pdf-tools-audit-official.json','npm-audit.json'],['.npm-cache/pdf-tools-audit.json','mirror-audit-failed.log'],
 ['.npm-cache/pdf-tools-plan-behavior-red.log','plan-red.log'],['.npm-cache/pdf-tools-engine-behavior-red.log','engine-red.log'],['.npm-cache/pdf-tools-plan-green.log','plan-green.log'],['.npm-cache/pdf-tools-unit-full.log','unit-i18n-failed.log'],['.npm-cache/pdf-tools-focused.log','sandbox-temp-failed.log'],['.npm-cache/pdf-tools-typecheck2.log','shell-substitution-failed.log'],
 ['.npm-cache/pdf-tools-browser-first.log','browser-cancel-selector-failed.log'],['.npm-cache/pdf-tools-browser-second.log','browser-cancel-label-failed.log'],['.npm-cache/pdf-tools-desktop-first.log','desktop-capture-failed.log'],['.npm-cache/pdf-tools-desktop-second.log','desktop-large-cdp-failed.log'],
 ['.npm-cache/pdf-tools-desktop-smoke.log','ocr-spacing-failed.log'],['.npm-cache/pdf-tools-desktop-smoke2.log','ocr-selection-failed.log'],['.npm-cache/pdf-tools-legacy-phase3.json','legacy-phase3-raw.json'],
 ['.npm-cache/pdf-tools-web-final.log','web-build.log'],['.npm-cache/pdf-tools-desktop-license-build.log','desktop-build.log'],['.npm-cache/pdf-tools-lint-final2.log','lint.log']])copyFileSync(from,`${final}/${to}`);
const installerPath='src-tauri/target/release/bundle/nsis/FileFlow_0.2.0-beta.2_x64-setup.exe';
for(const prior of[snapshot.installer,snapshot.installer.stable]){assert.equal(hash(prior.path),prior.sha256);assert.equal(statSync(prior.path).size,prior.bytes);}
const assets=readdirSync('dist-desktop/assets').filter(name=>name.includes('pdf-tools.worker')).map(name=>({path:`dist-desktop/assets/${name}`,bytes:statSync(`dist-desktop/assets/${name}`).size,sha256:hash(`dist-desktop/assets/${name}`)}));assert.equal(assets.length,1);
const audit=read('.npm-cache/pdf-tools-audit-official.json');assert.equal(audit.metadata.vulnerabilities.total,0);const installer={version:'0.2.0-beta.2',path:installerPath,bytes:statSync(installerPath).size,sha256:hash(installerPath),unsigned:true,sizeIncreaseFromBeta1:statSync(installerPath).size-snapshot.installer.bytes,priorVersionsPreserved:true};
const report={generatedAt:new Date().toISOString(),status:'PDF tools implemented and automated verification PASS; beta2 native installation/save/physical offline human acceptance pending',unit:{passed:540,total:540,added:36,accepted504Preserved:true,originalPhase3:103,identityErrors:[]},browser:{original:browser.stats,phase3,phase5Production:p5.stats,pdfTools:evidence},desktopRegression:{...smoke,scope:smokeReport.scope},frozen:{checked:16,changed:frozen.filter(item=>!item.pass),legacyWholeProjectSnapshot:'Raw expected differences preserved; never labeled PASS'},sourceReview:{acceptedSourceCount:snapshot.sourceFiles.length,changes,nativeSourceUnchanged:nativeUnchanged,originalRuntimeVersionsUnchanged:true,addedLockPackages:addedLock},checks:{lint:'PASS',typecheck:'PASS in independent check and final Web/Desktop build',webBuild:'PASS',desktopBuild:'PASS',npmAudit:audit.metadata.vulnerabilities,secrets:'pending final scan'},installer,assets,manual:{installation:'PENDING',nativeImportSave:'PENDING',physicalOfflineColdPdfTools:'PENDING'},limits:{fileMiB:40,combinedMiB:60,pages:500,outputs:50,resultMiB:64,seconds:60,sharedTransientMiB:256},privacyScope:'No new Rust IPC/capabilities or runtime external request observed; existing Gate v3 OS diagnostic/local crash-dump residual risk remains. Not an absolute zero-exfiltration or heap-bound guarantee.'};
writeFileSync(`${root}/results.json`,JSON.stringify(report,null,2)+'\n');writeFileSync(`${root}/installer.json`,JSON.stringify(installer,null,2)+'\n');writeFileSync(`${root}/frozen-algorithms.json`,JSON.stringify(frozen,null,2)+'\n');
// Re-recording automated evidence must not erase separately supplied human evidence.
const manualPath=`${root}/manual-acceptance-result.json`;
if(existsSync(manualPath)){
  const manual=read(manualPath);assert.equal(manual.version,installer.version);assert.equal(manual.installerSha256,installer.sha256);assert.equal(manual.result,'PASS — user-reported manual acceptance');
  report.status='Completed for personal local use — automated verification and user-reported consolidated manual acceptance';
  report.manual={...manual.checks,evidence:manualPath,source:manual.source};
  writeFileSync(`${root}/results.json`,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({unit:report.unit,browser:{original:90,phase3,phase5Production:44,pdfTools:'14 each Edge/Chrome/WebView2'},desktopRegression:smoke,installer,changes},null,2));
