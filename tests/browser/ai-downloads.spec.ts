import {test,expect,enterAi,processFixture,openAiExports} from './ai-harness';
import {readFileSync} from 'node:fs';
for(const behavior of ['silent','throw'])test(`batch ${behavior} failure preserves all files and individual retry works`,async({page})=>{
  await page.addInitScript(behavior=>{const original=HTMLAnchorElement.prototype.click;let count=0;HTMLAnchorElement.prototype.click=function(){if(this.download&&++count===2){if(behavior==='throw')throw new Error('fictional blocked download');return;}original.call(this);};},behavior);
  await enterAi(page);await processFixture(page,'ai-structure.md');await openAiExports(page);const downloads:string[]=[];page.on('download',d=>downloads.push(d.suggestedFilename()));await page.getByRole('button',{name:'Download all package files',exact:true}).click();
  if(behavior==='silent')await expect(page.getByRole('status')).toContainText('Download requests sent');else await expect(page.getByRole('alert')).toContainText('files remain available');
  await expect(page.locator('.ai-export-list button')).toHaveCount(4);await expect(page.locator('.ai-chunks')).toHaveCount(0);await expect(page.locator('.ai-download-note')).toContainText('individually');
  const waiting=page.waitForEvent('download');await page.locator('.ai-export-list').getByRole('button',{name:/Download .*part-001.md/}).click();const download=await waiting;expect(readFileSync((await download.path())!,'utf8')).toContain('虚构文档');expect(downloads).toContain(download.suggestedFilename());
  expect(await page.locator('.ai-exports').textContent()).not.toMatch(/all (?:files )?(?:saved|downloaded)|全部.*保存成功/i);
});
