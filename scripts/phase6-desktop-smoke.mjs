import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const evidence='docs/phase6/desktop-smoke/'+new Date().toISOString().replace(/[:.]/g,'-');await mkdir(evidence,{recursive:true});
const exe=path.resolve(process.argv[2]??'src-tauri/target/release/fileflow-desktop.exe');
const child=spawn(exe,[],{windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});let errors='';child.stderr.on('data',b=>errors+=b);
let browser;
try{
 for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:9223/json/version');if(r.ok)break;}catch{/* Startup endpoint not ready. */}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.connectOverCDP('http://127.0.0.1:9223');const page=browser.contexts()[0].pages()[0];await page.waitForSelector('.web-badge');
 const result={exe,pid:child.pid,url:page.url(),title:await page.title(),badge:await page.locator('.web-badge').innerText(),buttons:await page.getByRole('button').allTextContents(),privacy:await page.locator('.desktop-privacy').allTextContents(),instrumentation:'Official Microsoft/Playwright WebView2 remote debugging, test-process-only environment; not shipping flags. No user-data-folder override.'};
 await page.screenshot({path:evidence+'/window.png',fullPage:true});await writeFile(evidence+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){await writeFile(evidence+'/failure.json',JSON.stringify({error:String(error),errors,pid:child.pid},null,2)+'\n');throw error;}
finally{const pid=child.pid;if(pid){await new Promise(resolve=>{const close=spawn('powershell.exe',['-NoProfile','-Command',`$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){[void]$p.CloseMainWindow()}`],{windowsHide:true});close.on('exit',resolve);});}for(let i=0;i<50&&child.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));await writeFile(evidence+'/close.json',JSON.stringify({pid,exitCode:child.exitCode,closed:child.exitCode!==null},null,2)+'\n');if(browser)await browser.close().catch(()=>{});await writeFile(evidence+'/stderr.log',errors);}
