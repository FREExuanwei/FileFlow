/* global performance,PerformanceObserver */
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const stage=process.argv.includes('--after')?'after':'baseline',directory='docs/phase7';await mkdir(directory,{recursive:true});
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187','--strictPort'],{windowsHide:true,stdio:'pipe'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4187')).ok)break;}catch{/* wait for own server */}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1360,height:920}});const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.goto('http://127.0.0.1:4187');await page.getByLabel(/界面语言|Interface language/).selectOption('en');await page.getByRole('button',{name:'PDF tools',exact:true}).click();
 const file=path.resolve('.npm-cache/pdf-tools-fixtures/fictional-scan-38MiB.pdf'),bytes=await readFile(file);let workers=0;page.on('worker',w=>{if(/pdf\.worker/.test(w.url()))workers++;});
 await page.evaluate(()=>{performance.clearMarks();globalThis.__longTasks=[];try{new PerformanceObserver(list=>globalThis.__longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:false});}catch{/* Unsupported observed as absent */}});
 await page.locator('.pdf-tools input[type=file]').setInputFiles(file);await expect(page.locator('.pdf-sources li small')).toContainText('12 pages',{timeout:30000});await expect(page.locator('.pdf-preview canvas')).toHaveAttribute('aria-label','Page 1 preview');await expect(page.locator('.pdf-preview [role=status]')).toHaveCount(0,{timeout:30000});
 const startWorkers=workers,measurements=[];
 for(const number of [2,1,2,1,2,1]){const start=performance.now();await page.getByLabel('Preview page number',{exact:true}).fill(String(number));await expect(page.locator('.pdf-preview canvas')).toHaveAttribute('aria-label',`Page ${number} preview`);await expect(page.locator('.pdf-preview [role=status]')).toHaveCount(0,{timeout:30000});const painted=await page.locator('.pdf-preview canvas').evaluate(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<220||pixels[i+1]<220||pixels[i+2]<220)ink++;return ink;});assert.ok(painted>100);measurements.push({page:number,ms:Math.round(performance.now()-start)});}
 await page.locator('.pdf-toolbar .text-button').click();await expect(page.locator('.pdf-preview canvas')).toHaveCount(0);await new Promise(r=>setTimeout(r,500));
 const sessions=await page.context().newCDPSession(page);const targets=await sessions.send('Target.getTargets');const activeWorkers=targets.targetInfos.filter(t=>t.type==='worker').length;assert.equal(activeWorkers,0);assert.ok(requests.every(url=>new URL(url).hostname==='127.0.0.1'));
 const report={stage,measuredAt:new Date().toISOString(),browser:browser.version(),scope:'Real production Web/PDF.js; virtual file input, no native dialog/OS memory claim',fixture:{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},measurements,totalMs:measurements.reduce((n,m)=>n+m.ms,0),workersCreated:workers-startWorkers,workersAfterClear:activeWorkers,longTasks:await page.evaluate(()=>globalThis.__longTasks),externalRequests:[],appMemoryGuarantee:false};await writeFile(`${directory}/performance-${stage}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();child.kill();}
