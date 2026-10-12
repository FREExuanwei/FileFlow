import { expect,test,openAiAdvanced } from './ai-harness';
import { readFileSync } from 'node:fs';
test('before_after_summary_and_outline_match_real_result',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'AI Ready',exact:true}).click();await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/ai-structure.md');await expect(page.locator('.ai-process')).toBeEnabled();await page.locator('.ai-process').click();
  await expect(page.locator('.ai-clean-summary')).toHaveCount(1);await expect(page.locator('.ai-token-summary')).toContainText('Estimated tokens');
  await page.getByRole('button',{name:'Original extraction',exact:true}).click();await expect(page.locator('.ai-document-view')).toContainText('人工智能已经成为\n计算机科学');
  await page.getByRole('button',{name:'Cleaned Markdown',exact:true}).click();await page.locator('.ai-outline button').first().click();await expect(page.locator('.ai-document-view mark')).toContainText('虚构文档');
  await expect(page.locator('.ai-export-list button')).toHaveCount(4);
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download clean Markdown',exact:true}).click();const download=await waiting;const content=readFileSync((await download.path())!,'utf8');expect(content).toContain('人工智能已经成为计算机科学的重要方向。');expect(content).toContain('```js\nconst fictional = 1;\n  console.log(fictional);');
});
test('real_pdf_page_edge_counts_are_shown_and_scanned_pdf_fails',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'AI Ready',exact:true}).click();await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/ai-repeated.pdf');await page.locator('.ai-process').click();
  await expect(page.locator('[data-stat=headersRemoved]')).toContainText('4');await expect(page.locator('[data-stat=footersRemoved]')).toContainText('4');await expect(page.locator('[data-stat=pageNumbersRemoved]')).toContainText('4');
  await page.locator('.ai-clear').click();await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/no-text.pdf');await page.locator('.ai-process').click();await expect(page.getByRole('alert')).toContainText('OCR');
});
test('aggressive result warning uses semantic amber rather than normal body color',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'AI Ready',exact:true}).click();await page.locator('input[type=file]').setInputFiles('tests/fixtures/ai-mixed.txt');await openAiAdvanced(page);await page.locator('#ai-preset').selectOption('aggressive');await page.locator('.ai-process').click();await expect(page.locator('.ai-result-warning')).toBeVisible();
  expect(await page.locator('.ai-result-warning').evaluate(element=>{const sample=document.createElement('span');sample.style.color='var(--warning)';document.body.append(sample);const amber=getComputedStyle(sample).color;sample.remove();return getComputedStyle(element).color===amber;})).toBe(true);
});
