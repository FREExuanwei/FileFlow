/* global window, localStorage */
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout,clearTimeout} from 'node:timers';
const evidence=path.resolve('docs/phase6/desktop-security',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(evidence,{recursive:true});
const exe=path.join(process.env.LOCALAPPDATA,'Programs/FileFlow/fileflow-desktop.exe'),profileRoot=path.join(process.env.LOCALAPPDATA,'FileFlow.Desktop');
const results=[];let browser,page,child,hits=0;const server=createServer((_,res)=>{hits++;res.end('fictional-only');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
async function check(name,fn){try{results.push({name,status:'PASS',detail:await fn()});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:String(e)});throw e;}finally{await writeFile(evidence+'/results.json',JSON.stringify({exe,results,instrumentation:'Official test-only CDP. Renderer offline emulation does not establish physical OS disconnection. No native file-workflow PASS inferred.'},null,2)+'\n');}}
async function launch(){child=spawn(exe,[],{windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:9223/json/version')).ok)break;}catch{/* Endpoint not ready. */}await new Promise(r=>setTimeout(r,100));}browser=await chromium.connectOverCDP('http://127.0.0.1:9223');page=browser.contexts()[0].pages()[0];await page.waitForSelector('.web-badge');}
async function crashRenderer(){
 const targets=await (await fetch('http://127.0.0.1:9223/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url==='http://tauri.localhost/desktop.html');
 assert.ok(target?.webSocketDebuggerUrl,'own installed renderer must be identified');
 const endpoint=new URL(target.webSocketDebuggerUrl);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,'9223');
 // Disconnect Playwright before deliberately crashing: its transport otherwise
 // treats the expected target crash as an unhandled infrastructure failure.
 await browser.close();browser=undefined;page=undefined;
 let commandSent=false;
 await new Promise((resolve,reject)=>{
  const socket=new globalThis.WebSocket(endpoint.href);
  const timer=setTimeout(()=>{socket.close();if(commandSent)resolve();else reject(Error('crash command was not sent'));},3000);
  socket.addEventListener('open',()=>{socket.send(JSON.stringify({id:1,method:'Page.crash'}));commandSent=true;});
  socket.addEventListener('close',()=>{clearTimeout(timer);if(commandSent)resolve();else reject(Error('crash socket closed before command'));});
  socket.addEventListener('error',()=>{if(!commandSent){clearTimeout(timer);reject(Error('local crash transport failed'));}});
 });
 assert.ok(commandSent);return {transport:'isolated loopback CDP after Playwright disconnect',commandSent};
}
async function findDumps(){const dumps=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await walk(file);else if(/\.dmp$/i.test(e.name)){const bytes=await readFile(file);dumps.push({relative:path.relative(profileRoot,file),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}await walk(path.join(profileRoot,'profiles'));return dumps;}
async function close(){const pid=child?.pid;if(pid){await new Promise(r=>{const p=spawn('powershell.exe',['-NoProfile','-Command',`$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){[void]$p.CloseMainWindow()}`],{windowsHide:true});p.on('exit',r);});for(let i=0;i<60&&child.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));}if(browser)await browser.close().catch(()=>{});assert.ok(child?.exitCode!==null,'host must exit');}
try{
 await launch();
 await check('official privacy flags read back in installed app',async()=>{const p=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('privacy_status'));assert.ok(p.custom_crash_reporting&&p.in_private&&p.protected_profile);return p;});
 await check('capability rejects broad filesystem and shell commands',async()=>{return await page.evaluate(async()=>{const results=[];for(const command of ['plugin:fs|read_file','plugin:shell|execute','plugin:http|fetch']){try{await window.__TAURI_INTERNALS__.invoke(command,{});throw Error('unauthorized command succeeded');}catch(error){if(String(error).includes('unauthorized command succeeded'))throw error;results.push({command,rejected:true});}}return results;});});
 await check('CSP blocks network before fictional local server receives it',async()=>{const outcome=await page.evaluate(async url=>{try{await fetch(url,{method:'POST',body:'FICTIONAL_NETWORK_CANARY'});return 'unexpected success';}catch{return 'blocked';}},`http://127.0.0.1:${port}/fixture`);assert.equal(outcome,'blocked');assert.equal(hits,0);return {hits};});
 await check('remote navigation stays outside privileged view',async()=>{await page.evaluate(url=>{window.location.href=url;},`http://127.0.0.1:${port}/navigation`).catch(()=>{});await new Promise(r=>setTimeout(r,300));assert.equal(page.url(),'http://tauri.localhost/desktop.html');assert.equal(hits,0);});
 await check('installed bundled UI loads under renderer offline emulation',async()=>{await browser.contexts()[0].setOffline(true);await page.reload();await expect(page.locator('.web-badge')).toHaveText('DESKTOP');await browser.contexts()[0].setOffline(false);return {physicalOsDisconnectionVerified:false};});
 await check('hostile fictional markup cannot execute or obtain IPC in sandbox',async()=>{await page.getByLabel(/界面语言|Interface language/).selectOption('en');await page.locator('input[type=file]').first().setInputFiles({name:'fictional-isolation.md',mimeType:'text/markdown',buffer:Buffer.from('# FICTIONAL_CRASH_CANARY_20261009\n\n<script>window.parent.EXFIL=true;window.parent.__TAURI_INTERNALS__.invoke("read_input",{id:"made-up",offset:0,length:1})</script>\n\n![remote](http://127.0.0.1:'+port+'/image)')});await page.getByRole('button',{name:'Convert file',exact:true}).click();await expect(page.locator('iframe')).toBeVisible();assert.equal(await page.locator('iframe').getAttribute('sandbox'),'');assert.equal(await page.evaluate(()=>'EXFIL' in window),false);assert.equal(hits,0);return {admission:'fictional DOM file-input injection, not native-workflow acceptance'};});
 await check('renderer persists only language/theme preference keys',async()=>{const keys=await page.evaluate(()=>Object.keys(localStorage));assert.ok(keys.every(k=>['fileflow.language','fileflow-theme'].includes(k)));return {keys};});
 const oldSessions=await readdir(path.join(profileRoot,'profiles'));
 await check('controlled renderer crash produces auditable protected local artifacts',async()=>{const transport=await crashRenderer();let dumps=[];for(let i=0;i<150;i++){dumps=await findDumps();if(dumps.some(d=>d.size>0))break;await new Promise(r=>setTimeout(r,100));}assert.ok(dumps.some(d=>d.size>0),'actual nonempty dump creation must be observed');return {transport,dumps,claim:'Local dumps permitted by Gate v2; no claim that sensitive content is absent or never written.'};});
 await close();
 await launch();
 await check('next startup removes prior session and dump directories',async()=>{const now=await readdir(path.join(profileRoot,'profiles'));assert.ok(oldSessions.every(s=>!now.includes(s)));assert.equal(now.length,1);const prefs=await stat(path.join(profileRoot,'preferences.bin'));assert.equal(prefs.size,2);return {priorSessionsRemoved:true,preferencesBytes:2};});
 await close();
}catch(error){process.exitCode=1;await writeFile(evidence+'/failure.json',JSON.stringify({error:String(error)},null,2)+'\n');if(child?.exitCode===null)await close().catch(()=>{});}
finally{await new Promise(r=>server.close(r));console.log(JSON.stringify({evidence,results:results.map(r=>({name:r.name,status:r.status}))}));}
