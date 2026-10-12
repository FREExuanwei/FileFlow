import { expect,test,openAiAdvanced } from './ai-harness';
for(const language of ['zh-CN','en'])for(const theme of ['light','dark'])test(`${language} ${theme}: AI defaults and seven options`,async({page})=>{
  await page.addInitScript(({language,theme})=>{localStorage.setItem('fileflow.language',language);localStorage.setItem('fileflow-theme',theme);},{language,theme});
  await page.goto('/');await expect(page.getByRole('button',{name:'AI Ready',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'AI Ready',exact:true}).click();
  await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/ai-mixed.txt');
  await expect(page.locator('.ai-workspace .queue-row[data-status=ready]')).toHaveCount(1);
  await expect(page.locator('#ai-preset')).toHaveValue('balanced');await expect(page.locator('#ai-strategy')).toHaveValue('auto');await expect(page.locator('#ai-target')).toHaveValue('4000');await expect(page.locator('#ai-overlap')).toHaveValue('0');
  await expect(page.locator('.ai-options input[type=checkbox]')).toHaveCount(7);
  await expect(page.locator('.ai-advanced')).not.toHaveAttribute('open');await openAiAdvanced(page);await page.locator('#ai-preset').selectOption('conservative');await expect(page.locator('#ai-mergeLines')).not.toBeChecked();
  await page.locator('#ai-preset').selectOption('aggressive');await expect(page.locator('.ai-aggressive')).toBeVisible();
});
