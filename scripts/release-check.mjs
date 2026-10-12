import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function releaseIssues(report){
 const issues=[];
 if(!/^0\.2\.0-rc\.\d+$/.test(report.version??''))issues.push('Expected an explicitly identified Phase8 RC version.');
 if(report.unit?.passed!==550||report.unit?.total!==550||!report.unit?.accepted550Preserved)issues.push('Original unit baseline is not fully verified.');
 if(report.browser?.original!==90||report.browser?.phase3!==47||report.browser?.retries!==0)issues.push('Original browser/Phase3 run is not fully verified.');
 if(report.frozen?.passed!==16)issues.push('Frozen algorithm integrity not verified.');
 if(report.rust?.failed||report.rust?.unverified)issues.push('Rust permission suite has failed or unverified scenarios; retest in an approved environment.');
 for(const key of['lint','typecheck','webBuild','desktopBuild','npmAudit','nativeAudit','secrets'])if(report.checks?.[key]!==true)issues.push(`Required check not passed: ${key}`);
 if(!report.manual?.status?.startsWith('PASS'))issues.push('Formal installed native/offline manual acceptance pending.');
 if(!report.installer?.hashVerified)issues.push('Installer integrity not verified.');
 if(report.installer?.signatureStatus!=='Valid')issues.push('Publisher identity not verified by a trusted signature.');
 if(!report.projectLicenseDecisionAuthorized)issues.push('Owner has not decided public source/distribution licensing.');
 if(!report.publicReleaseAuthorized)issues.push('Owner has not authorized public release.');
 return issues;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const file=process.argv[2]??'docs/phase8/results.json',report=JSON.parse(readFileSync(file,'utf8'));
 const bytes=readFileSync(report.installer.path),actual=createHash('sha256').update(bytes).digest('hex').toUpperCase();report.installer.hashVerified=actual===report.installer.sha256;
 const issues=releaseIssues(report);console.log(JSON.stringify({scope:'Read-only public release readiness check; never builds, uploads, signs or publishes.',version:report.version,installerHashVerified:report.installer.hashVerified,ready:issues.length===0,issues},null,2));process.exitCode=issues.length?1:0;
}
