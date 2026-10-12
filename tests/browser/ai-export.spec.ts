import {test,expect,enterAi,openAiExports} from './ai-harness';
import {readFileSync} from 'node:fs';
import MarkdownIt from 'markdown-it';
import type {Page} from '@playwright/test';
async function downloaded(page:Page,name:string){await openAiExports(page);const wait=page.waitForEvent('download');await page.locator('.ai-export-list').getByRole('button',{name:`Download ${name}`,exact:true}).click();return readFileSync((await(await wait).path())!,'utf8');}
const destinations=(text:string)=>new MarkdownIt().parse(text,{}).flatMap(t=>t.children??[]).filter(t=>t.type==='link_open').map(t=>decodeURIComponent(String(t.attrGet('href'))));
test('package names remain unique across formats, truncation and task removal',async({page})=>{
  await enterAi(page);const names=['report.md','report.txt','a'.repeat(95)+'first.md','a'.repeat(95)+'second.md'];
  await page.locator('input[type=file]').setInputFiles(names.map((name,i)=>({name,mimeType:name.endsWith('.txt')?'text/plain':'text/markdown',buffer:Buffer.from(`# Fictional ${i}\n\nUnique fictional body ${i}.`)})));
  await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(4);await page.getByRole('button',{name:'Check all ready documents',exact:true}).click();await expect(page.locator('.queue-row:is([data-status=completed],[data-status=warning])')).toHaveCount(4);
  const partNames:string[]=[];
  for(let i=0;i<4;i++){await page.locator('.queue-select').nth(i).click();const metadata=JSON.parse(await downloaded(page,'metadata.json')),name=metadata.chunks[0].file;partNames.push(name);expect(destinations(await downloaded(page,'index.md'))).toEqual([name]);expect(await downloaded(page,name)).toContain(`Unique fictional body ${i}.`);}
  expect(new Set(partNames).size).toBe(4);await page.locator('.queue-remove').first().click();await page.locator('.queue-select').first().click();expect(JSON.parse(await downloaded(page,'metadata.json')).chunks[0].file).toBe(partNames[1]);
});
test('Unicode and Markdown-delimiter names export working indexes and chunks',async({page})=>{
  await enterAi(page);
  for(const name of ['😀'.repeat(60)+'.md','Report).md']){await page.locator('input[type=file]').setInputFiles({name,mimeType:'text/markdown',buffer:Buffer.from('# Fictional Unicode\n\nFictional content.')});await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible();const metadata=JSON.parse(await downloaded(page,'metadata.json')),part=metadata.chunks[0].file;expect(destinations(await downloaded(page,'index.md'))).toEqual([part]);expect(await downloaded(page,part)).toContain('Fictional content.');await page.locator('.ai-clear').click();}
});
test('line-dense input completes in real Worker and excess scratch is controlled',async({page})=>{
  await enterAi(page);await page.locator('input[type=file]').setInputFiles({name:'fictional-dense.txt',mimeType:'text/plain',buffer:Buffer.from('x\n'.repeat(500000))});await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible({timeout:65000});expect(JSON.parse(await downloaded(page,'metadata.json')).tokenEstimate.exact).toBe(false);
  await page.locator('.ai-clear').click();await page.locator('input[type=file]').setInputFiles({name:'fictional-dense-cap.txt',mimeType:'text/plain',buffer:Buffer.from('x\n'.repeat(3000000))});await page.locator('.ai-process').click();await expect(page.getByRole('alert')).toContainText('Shared session capacity');await expect(page.locator('.queue-row[data-status=failed]')).toHaveCount(1);await page.locator('.ai-clear').click();await expect(page.locator('.queue-row')).toHaveCount(0);
});
