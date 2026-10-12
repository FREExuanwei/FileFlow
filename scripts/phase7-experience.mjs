/* global getComputedStyle, document */
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const dir='docs/phase7/experience';await mkdir(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188','--strictPort'],{windowsHide:true,stdio:'pipe'});
const results=[];let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4188')).ok)break;}catch{/* own local server startup */}await new Promise(r=>setTimeout(r,100));}
 for(const channel of ['msedge','chrome']){
  browser=await chromium.launch({channel,headless:true});const page=await browser.newPage({viewport:{width:1360,height:920}}),requests=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.goto('http://127.0.0.1:4188');await page.getByLabel(/界面语言|Interface language/).selectOption('en');
  const data=page.getByRole('button',{name:'Data tools',exact:true});await data.focus();await page.keyboard.press('Enter');await expect(page.locator('#p5-import-tool')).toBeVisible();
  await page.locator('.p5-utility-import>.text-button').click();await expect(page.locator('#p5-import-tool')).toHaveCount(0);await data.click();await expect(page.locator('#p5-import-tool')).toBeVisible();
  await data.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(data).toBeFocused();const focused=await data.evaluate(el=>el.matches(':focus-visible'));assert.ok(focused);
  await page.getByRole('button',{name:'PDF tools',exact:true}).click();const cdp=await page.context().newCDPSession(page),cycles=[];
  for(let i=0;i<8;i++){
   await page.locator('.pdf-tools input[type=file]').setInputFiles(path.resolve('.npm-cache/pdf-tools-fixtures/fictional-alpha.pdf'));await expect(page.locator('.pdf-sources li small')).toContainText('3 pages');await expect(page.locator('.pdf-preview [role=status]')).toHaveCount(0);
   await page.locator('[data-testid=pdf-operation]').selectOption('extract');await page.locator('[data-testid=pdf-selection]').fill('3,1');await expect(page.locator('[data-testid=pdf-plan]')).toContainText('3 → 1');await page.locator('[data-testid=pdf-run]').click();await expect(page.locator('[data-testid=pdf-status]')).toContainText('New PDFs created');
   await page.locator('.pdf-toolbar .text-button').click();await expect(page.locator('.pdf-output')).toHaveCount(0);await expect(page.locator('.pdf-preview canvas')).toHaveCount(0);
   await expect.poll(async()=>(await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker').length,{timeout:5000}).toBe(0);await cdp.send('HeapProfiler.collectGarbage');const workers=(await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker').length;assert.equal(workers,0);const usage=await cdp.send('Runtime.getHeapUsage');cycles.push({cycle:i+1,workers,usedJsHeapBytes:usage.usedSize});
  }
  await page.locator('.pdf-tools input[type=file]').setInputFiles(path.resolve('.npm-cache/pdf-tools-fixtures/fictional-alpha.pdf'));await expect(page.locator('.pdf-sources li small')).toContainText('3 pages');await expect(page.locator('.pdf-preview [role=status]')).toHaveCount(0);const themes=[];
  for(const language of ['zh-CN','en']){await page.getByLabel(/界面语言|Interface language/).selectOption(language);for(const theme of ['light','dark']){
   await page.locator('.theme-picker select').selectOption(theme);const color=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());assert.equal(color,theme==='light'?'#edf3f8':'#101a29');themes.push({language,theme,pageBackground:color});await page.screenshot({path:`${dir}/${channel}-${language}-${theme}.png`,fullPage:true,animations:'disabled'});
  }}
  await page.setViewportSize({width:390,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert.equal(overflow,false);assert.ok(requests.every(u=>new URL(u).hostname==='127.0.0.1'));
  results.push({channel,browser:browser.version(),status:'PASS',keyboardDataShortcut:true,reopenShortcut:true,cycles,themes,mobileOverflow:false,externalRequests:[],scope:'8 repeated real PDF render/extract/clear cycles. GC-assisted JS heap observation; not total process memory or a long-duration stability guarantee.'});await browser.close();browser=undefined;
 }
 console.log('PASS Edge/Chrome navigation, palette, four theme/language combinations and 8 repeated PDF cycles each');
}catch(error){results.push({status:'FAIL',error:String(error)});console.error(String(error));process.exitCode=1;}
finally{await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2)+'\n');await browser?.close();server.kill();}
