import {test,expect,enterAi,processFixture,openAiAdvanced,openAiExports} from './ai-harness';
import {readFileSync} from 'node:fs';
for(const [name,text]of [['demo.pdf','FileFlow Demo PDF'],['demo.docx','Bold sample'],['ai-structure.md','虚构文档'],['ai-code.html','fictional'],['ai-mixed.txt','人工智能']] as const)test(`AI five-format integration: ${name}`,async({page})=>{
  await enterAi(page);await processFixture(page,name);const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download clean Markdown',exact:true}).click();const file=await wait;expect(readFileSync((await file.path())!,'utf8')).toContain(text);
});
test('ambiguous PDF body stays in Conservative and Balanced; candidate keep overrides real edges',async({page})=>{
  await enterAi(page);await processFixture(page,'ai-ambiguous.pdf');await expect(page.locator('[data-stat=headersRemoved] dd')).toHaveText('0');
  await openAiAdvanced(page);await page.locator('#ai-preset').selectOption('conservative');await page.locator('.ai-process').click();await expect(page.locator('.aiChanged')).toHaveCount(0);await expect(page.locator('.queue-row:is([data-status=completed],[data-status=warning])')).toHaveCount(1);await expect(page.locator('[data-stat=headersRemoved] dd')).toHaveText('0');
  await page.locator('.ai-clear').click();await processFixture(page,'ai-repeated.pdf');await openAiAdvanced(page);await page.locator('.ai-candidates summary').click();const candidates=page.locator('.ai-candidates select');await candidates.first().selectOption('keep');await page.locator('.ai-process').click();await expect(page.locator('[data-stat=headersRemoved] dd')).toHaveText('0');await expect(page.locator('[data-stat=footersRemoved] dd')).toHaveText('4');
});
test('long outline source window, chunk integrity and estimate metadata',async({page})=>{
  const text='# Start\n\n'+('Fictional sentence with Chinese 虚构内容.\n\n'.repeat(6500))+'# Final fictional heading\n\nEnd.\n';
  await enterAi(page);await page.locator('input[type=file]').setInputFiles({name:'fictional-long.md',mimeType:'text/markdown',buffer:Buffer.from(text)});await openAiAdvanced(page);await page.locator('#ai-strategy').selectOption('tokens');await page.locator('#ai-target').selectOption('2000');await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible();
  await page.locator('.ai-outline button').last().click();await expect(page.locator('.ai-document-view mark')).toContainText('Final fictional heading');expect(await page.locator('.source-preview').textContent()).toHaveLength(Math.min(200000,1000+'# Final fictional heading\n\nEnd.\n'.length));
  const cleanWait=page.waitForEvent('download');await page.getByRole('button',{name:'Download clean Markdown',exact:true}).click();const clean=readFileSync((await(await cleanWait).path())!,'utf8');
  await openAiExports(page);const metadataWait=page.waitForEvent('download');await page.locator('.ai-export-list').getByRole('button',{name:'Download metadata.json',exact:true}).click();const metadata=JSON.parse(readFileSync((await(await metadataWait).path())!,'utf8'));
  expect(metadata.tokenEstimate.exact).toBe(false);expect(metadata.chunking.overlapPercent).toBe(0);let assembled='';
  for(const chunk of metadata.chunks){const wait=page.waitForEvent('download');await page.locator('.ai-export-list').getByRole('button',{name:`Download ${chunk.file}`,exact:true}).click();assembled+=readFileSync((await(await wait).path())!,'utf8');}
  expect(assembled).toBe(clean);expect(metadata.chunks.length).toBeGreaterThan(2);
});
test('AI validation handles malformed encoding and input cap without processing',async({page})=>{
  await enterAi(page);await page.locator('input[type=file]').setInputFiles({name:'fictional-invalid.txt',mimeType:'text/plain',buffer:Buffer.from([255,254])});await page.locator('.ai-process').click();await expect(page.getByRole('alert')).toContainText('UTF-8');
  await page.locator('.ai-clear').click();await page.locator('input[type=file]').setInputFiles({name:'fictional-over-cap.txt',mimeType:'text/plain',buffer:Buffer.alloc(10*1024**2+1,65)});await expect(page.getByRole('alert')).toContainText('size limit');await expect(page.locator('.queue-row[data-status=failed]')).toHaveCount(1);
});
