import { expect,test } from './ai-harness';
test('real local worker processes and clear releases the document',async({page})=>{
  await page.goto('/');await expect(page.getByRole('button',{name:'AI Ready',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'AI Ready',exact:true}).click();
  const workers:string[]=[];page.on('worker',worker=>workers.push(worker.url()));
  await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/ai-structure.md');
  await expect(page.locator('.ai-workspace .queue-row[data-status=ready]')).toHaveCount(1);await page.locator('.ai-process').click();
  await expect(page.locator('.ai-workspace .queue-row[data-status=completed]')).toHaveCount(1);
  expect(workers.some(url=>url.includes('ai-ready.worker'))).toBe(true);
  await page.locator('.ai-clear').click();await expect(page.locator('.ai-workspace .queue-row')).toHaveCount(0);
});
test('cancel and remove a real Worker, switch modes, replace same name without late results',async({page,context})=>{
  let intercepted=false,closed=false;await context.route(/ai-ready\.worker-.*\.js$/,async route=>{if(intercepted){await route.continue();return;}intercepted=true;const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst originalHandler=self.onmessage; self.onmessage=event=>setTimeout(()=>originalHandler(event),20000);'});});
  await page.goto('/');await page.getByRole('button',{name:'AI Ready',exact:true}).click();page.on('worker',worker=>{if(!intercepted)return;worker.on('close',()=>{closed=true;});});
  await page.locator('input[type=file]').setInputFiles({name:'fictional-same.txt',mimeType:'text/plain',buffer:Buffer.from('# Old fictional\n\nObsolete content.')});await page.locator('.ai-process').click();await expect.poll(()=>intercepted).toBe(true);await expect(page.locator('.queue-row[data-status=processing]')).toHaveCount(1);await page.screenshot({path:'docs/phase3/screenshots/processing.png',fullPage:true});
  await page.getByRole('button',{name:'Converter',exact:true}).click();await page.getByRole('button',{name:'AI Ready',exact:true}).click();await expect(page.locator('.queue-row[data-status=processing]')).toHaveCount(1);await page.getByRole('button',{name:'Cancel conversion',exact:true}).click();await expect(page.locator('.queue-row[data-status=cancelled]')).toHaveCount(1);await expect.poll(()=>closed).toBe(true);
  await page.locator('.ai-clear').click();await page.locator('input[type=file]').setInputFiles({name:'fictional-same.txt',mimeType:'text/plain',buffer:Buffer.from('# New fictional\n\nReplacement content.')});await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible();await expect(page.frameLocator('iframe').locator('body')).toContainText('Replacement content');await expect(page.frameLocator('iframe').locator('body')).not.toContainText('Obsolete content');
});
