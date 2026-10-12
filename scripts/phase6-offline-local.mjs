import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout} from 'node:timers/promises';
import assert from 'node:assert/strict';

// Manually launched local test runner. Never changes adapters, firewall, policy,
// user documents or application files. Only fictional installed-E2E fixtures.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs/phase6/offline-local',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(output,{recursive:true});
const result={time:new Date().toISOString(),status:'PREPARING',physicalSamples:[],testOnlyCdp:true,nativeDialogs:false,
  limits:'Physical adapter sampling, not packet capture or proof of no runtime diagnostics. No network settings changed by runner.'};
const save=()=>writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
function powershell(command){return execFileSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();}
function physicalState(){const state=JSON.parse(powershell("$a=@(Get-NetAdapter -Physical -ErrorAction Stop); @{total=$a.Count;up=@($a | Where-Object Status -eq 'Up').Count} | ConvertTo-Json -Compress"));assert.ok(Number.isInteger(state.total)&&Number.isInteger(state.up));return state;}
try{
 const existing=Number(powershell("@(Get-Process -Name fileflow-desktop -ErrorAction SilentlyContinue).Count"));
 assert.equal(existing,0,'Close FileFlow yourself before starting; runner does not close user work.');
 const initial=physicalState();assert.ok(initial.total>0&&initial.up>0,'A connected physical adapter is required to verify a disconnect transition.');
 result.physicalSamples.push({phase:'connected-before',...initial});result.status='WAITING_FOR_USER_DISCONNECT';await save();
 console.log('READY. Disconnect Wi-Fi/Ethernet now. Do not reconnect until OFFLINE_TEST_FINISHED. Waiting up to180seconds.');
 const deadline=Date.now()+180000;let offline=false;
 while(Date.now()<deadline){const state=physicalState();if(state.up===0){result.physicalSamples.push({phase:'disconnected-before',...state});offline=true;break;}await setTimeout(1000);}
 assert.ok(offline,'No physical disconnect observed before timeout; no test PASS.');
 result.status='RUNNING_INSTALLED_FICTIONAL_TESTS';await save();
 const child=spawn(process.execPath,['scripts/phase6-installed-e2e.mjs','--non-dialog'],{cwd:root,windowsHide:true});
 let log='';child.stdout.on('data',bytes=>{log+=bytes;process.stdout.write(bytes);});child.stderr.on('data',bytes=>{log+=bytes;process.stderr.write(bytes);});
 const exit=await new Promise(resolve=>child.on('exit',(code,signal)=>resolve({code,signal})));await writeFile(path.join(output,'installed.log'),log);
 result.child=exit;assert.equal(exit.code,0,'Installed regression failed; see installed.log.');
 const latest=JSON.parse(await readFile(path.join(root,'docs/phase6/installed-e2e/latest.json'),'utf8'));
 const evidence=JSON.parse(await readFile(path.join(latest.evidence,'results.json'),'utf8'));
 assert.equal(evidence.nativeDialogsRun,false);assert.equal(evidence.results.length,16);assert.ok(evidence.results.every(r=>r.status==='PASS'));
 const after=physicalState();result.physicalSamples.push({phase:'disconnected-after',...after});assert.equal(after.up,0,'Network restored before verification finished; no offline PASS.');
 result.installedEvidence=latest.evidence;result.passed=16;result.status='PASS_PHYSICAL_DISCONNECT_SAMPLED_INSTALLED_REGRESSION';await save();
}catch(error){result.status='FAIL';result.error=String(error);await save();console.error(result.error);process.exitCode=1;}
finally{console.log('OFFLINE_TEST_FINISHED. You may reconnect now. Evidence: '+output);}
