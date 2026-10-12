/* global document */
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const root='.npm-cache/phase65-worker-load-probe';await mkdir(root,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4174','--strictPort'],{windowsHide:true});let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
const events=[];let browser;const started=Date.now();let result;
try{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error('Vite exited '+server.exitCode);try{if((await fetch('http://127.0.0.1:4174')).ok)break;}catch{/* Server startup. */}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4174'?route.continue():route.abort());const page=await context.newPage();
 page.on('request',r=>events.push({kind:'request',url:r.url(),ms:Date.now()-started}));page.on('requestfinished',r=>events.push({kind:'finished',url:r.url(),ms:Date.now()-started}));page.on('requestfailed',r=>events.push({kind:'failed',url:r.url(),ms:Date.now()-started,failure:r.failure()}));page.on('pageerror',e=>events.push({kind:'pageerror',message:String(e),ms:Date.now()-started}));
 await page.goto('http://127.0.0.1:4174/tests/phase5-browser/phase5-worker.html');await page.locator('#route').selectOption('tsv-to-csv');await page.locator('#input').setInputFiles({name:'fictional.tsv',mimeType:'text/plain',buffer:Buffer.from('name\tvalue\r\n虚构\t42')});const runStart=Date.now();await page.locator('#run').click();
 // Observation only: this 60s wait is not a replacement assertion or a test PASS.
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent!=='processing',{timeout:60000});result={status:await page.locator('#status').textContent(),runMs:Date.now()-runStart,preview:await page.locator('#preview').textContent(),scope:'Diagnostic observation; not acceptance PASS; original 5s assertion remains unchanged'};
}catch(e){result={error:String(e)};process.exitCode=1;}finally{if(browser)await browser.close();server.kill();await writeFile(root+'/result.json',JSON.stringify({result,events},null,2));await writeFile(root+'/server.log',output);console.log(JSON.stringify(result));}
