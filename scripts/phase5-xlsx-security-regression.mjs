import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {clearTimeout} from 'node:timers';
import {inspectArchive,sha256} from './review-phase5-package.mjs';
const archive=readFileSync('vendor/xlsx-0.20.3.tgz');assert.equal(sha256(archive),'8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8');
const source=inspectArchive(archive).get('package/xlsx.mjs').toString(),fixed=readFileSync('docs/phase5/dependencies/raw/xlsx-0.20.2-fixed.txt','utf8'),prototypeFixed=readFileSync('docs/phase5/dependencies/raw/xlsx-0.19.3-fixed.txt','utf8');
assert(source.includes('if(r.r < 0 || r.c < 0) return;'));assert(prototypeFixed.includes('if(r.r < 0 || r.c < 0) return;'));
const names=['closeparen','attregexg','tagregex1','xlmlregex','vtvregex','custregex','sitregex','mergecregex','hlinkregex','colregex','afregex','marginregex','sheetprregex','sviewregex','attregexg2','attregex2'];
const fixedLines=names.map(name=>fixed.split('\n').find(line=>line.startsWith(`var ${name}`)));for(const line of fixedLines){assert(line);assert(source.includes(line),'Actual source differs from fixed regex line');}
const worker=new Worker(new URL('./phase5-xlsx-security-worker.mjs',import.meta.url),{workerData:{source},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16}});
const started=performance.now();
const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Bounded security regression timeout'));},10000);worker.once('message',message=>{clearTimeout(timer);resolve(message);});worker.once('error',error=>{clearTimeout(timer);reject(error);});worker.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(new Error(`Isolated worker exited${code}`));}});});
await worker.terminate();assert.equal(result.pass,true,JSON.stringify(result));
const report={decision:'PASS',archiveSha256:sha256(archive),sourceSha256:sha256(Buffer.from(source)),fixedRegexLines:names,prototypeGuard:true,isolated:true,timeoutMs:10000,memoryLimitMb:128,elapsedMs:Math.round(performance.now()-started),...result};
writeFileSync('docs/phase5/validation/task-09/security-regression.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
