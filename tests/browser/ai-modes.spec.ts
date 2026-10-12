import {expect,test} from './ai-harness';
test('mode_switch_preserves_both_queues_and_formats_privacy_explain_ai',async({page})=>{
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(1);
  await page.getByRole('button',{name:'AI Ready',exact:true}).click();await page.locator('.ai-workspace input[type=file]').setInputFiles('tests/fixtures/ai-mixed.txt');await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible();
  await page.getByRole('button',{name:'Converter',exact:true}).click();await expect(page.locator('.queue-row')).toHaveCount(1);await page.getByRole('button',{name:'Convert all ready files',exact:true}).click();await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(1);
  await page.getByRole('button',{name:'AI Ready',exact:true}).click();await expect(page.locator('.ai-clean-summary')).toBeVisible();
  await page.getByRole('link',{name:'Formats',exact:true}).click();await expect(page.locator('.ai-feature')).toContainText('No AI API');await page.getByRole('button',{name:'Privacy',exact:true}).click();await expect(page.locator('dialog')).toContainText('No document content is sent');
});
test('image_mode_reuses_existing_tools_without_destroying_documents',async({page})=>{
  await page.goto('/');await page.locator('input[type=file]').setInputFiles(['tests/fixtures/demo.csv','tests/fixtures/demo.png']);await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Images',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Images',exact:true}).click();await expect(page.locator('.queue-row')).toHaveCount(1);await expect(page.getByLabel('Width (px)',{exact:true})).toHaveValue('128');
  await page.getByRole('button',{name:'Convert all ready files',exact:true}).click();await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(1);
  await page.getByRole('button',{name:'Converter',exact:true}).click();await expect(page.locator('.queue-row')).toHaveCount(2);await expect(page.locator('.queue-row[data-status=ready]')).toContainText('demo.csv');
});
test('image_mode_reentry_preserves_chosen_output_and_dimensions',async({page})=>{
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.png');await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(1);await page.getByRole('button',{name:'Images',exact:true}).click();
  await page.locator('#target').selectOption('jpeg');await page.getByLabel('Width (px)',{exact:true}).fill('64');await page.getByRole('button',{name:'AI Ready',exact:true}).click();await page.getByRole('button',{name:'Images',exact:true}).click();await expect(page.locator('#target')).toHaveValue('jpeg');await expect(page.getByLabel('Width (px)',{exact:true})).toHaveValue('64');
});
