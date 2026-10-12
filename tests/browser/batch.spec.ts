import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
// Capture stable final colors/states and exercise the reduced-motion preference.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && (!request.url().startsWith('http://127.0.0.1:4174/') || request.method() !== 'GET')) requests.push(request.url()); });
  await page.exposeFunction('batchNetworkCheck', () => requests);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => (window as unknown as { batchNetworkCheck: () => Promise<string[]> }).batchNetworkCheck())).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => !['fileflow.language', 'fileflow-theme'].includes(key)))).toEqual([]);
});

test('mixed batch: independent failure, retry, add/remove, downloads and memory-only reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'demo.csv', mimeType: 'text/csv', buffer: readFileSync('tests/fixtures/demo.csv') },
    { name: 'demo.pdf', mimeType: 'application/pdf', buffer: readFileSync('tests/fixtures/demo.pdf') },
    { name: 'demo.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/demo.png') },
    { name: 'demo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: readFileSync('tests/fixtures/demo.docx') },
    { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad}') },
  ]);
  await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(5);
  await expect(page.locator('.hero,.privacy-section,.formats-section')).toHaveCount(0);
  await page.screenshot({ path: 'docs/phase2/screenshots/desktop-loaded.png', fullPage: true });
  await page.getByRole('button', { name: 'Convert all ready files', exact: true }).click();
  await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(4);
  await expect(page.locator('.queue-row[data-status=failed]')).toHaveCount(1);
  await page.screenshot({ path: 'docs/phase2/screenshots/desktop-mixed-completed.png', fullPage: true });
  await page.getByRole('button', { name: 'Select bad.json', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
  await page.screenshot({ path: 'docs/phase2/screenshots/desktop-failed.png', fullPage: true });
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  await expect.poll(() => downloads).toEqual(['demo.json', 'demo.md', 'demo.webp', 'demo (1).md']);
  await page.getByRole('button', { name: 'Clear completed', exact: true }).click();
  await expect(page.locator('.queue-row')).toHaveCount(1);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
  await expect(page.locator('.queue-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove bad.json', exact: true }).click();
  await expect(page.locator('.queue-row')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.queue-row')).toHaveCount(0);
});

test('same format batch applies target and rejects unsafe names; collisions match downloads', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  const buffer = readFileSync('tests/fixtures/demo.pdf');
  await page.locator('input[type=file]').setInputFiles([{ name: 'one.pdf', mimeType: 'application/pdf', buffer }, { name: 'two.pdf', mimeType: 'application/pdf', buffer }]);
  await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(2);
  await page.getByLabel('Output for matching files').selectOption('pdf-to-txt');
  await expect(page.locator('.queue-row')).toContainText(['Plain text', 'Plain text']);
  await page.getByLabel('Output file name').fill('../escape'); await expect(page.getByRole('alert')).toContainText('valid file name');
  await expect(page.getByRole('button', { name: 'Convert file', exact: true })).toBeDisabled();
  await page.getByLabel('Output file name').fill('shared');
  await page.getByRole('button', { name: 'Select two.pdf', exact: true }).click();
  await page.getByLabel('Output file name').fill('shared');
  await page.getByRole('button', { name: 'Convert all ready files', exact: true }).click();
  await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'shared (1).txt', exact: true })).toBeVisible();
  const names: string[] = []; page.on('download', download => names.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  await expect.poll(() => names).toEqual(['shared.txt', 'shared (1).txt']);
});

test('image tools validate before canvas allocation and preserve aspect ratio and PNG quality behavior', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { type?: string; quality?: number; width: number; height: number }[] = [];
    Object.assign(window, { encoderCalls: calls });
    const native = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) { calls.push({ type, quality, width: this.width, height: this.height }); return native.call(this, callback, type, quality); };
  });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.png');
  await page.getByRole('button', { name: 'Image tools', exact: true }).click();
  await page.getByLabel('Width (px)', { exact: true }).fill('64');
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('48');
  await page.getByLabel('Height (px)', { exact: true }).fill('24');
  await expect(page.getByLabel('Width (px)', { exact: true })).toHaveValue('32');
  await page.getByLabel('Keep aspect ratio').uncheck();
  await page.getByLabel('Width (px)', { exact: true }).fill('6000');
  await page.getByLabel('Height (px)', { exact: true }).fill('6000');
  await expect(page.getByRole('alert')).toContainText('safety limit');
  await expect(page.getByRole('button', { name: 'Convert file', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Convert all ready files', exact: true })).toBeDisabled();
  await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { encoderCalls: unknown[] }).encoderCalls.length)).toBe(0);
  await page.getByRole('button', { name: 'Reset dimensions', exact: true }).click();
  await page.getByLabel('Width (px)', { exact: true }).fill('64');
  await page.getByLabel('Height (px)', { exact: true }).fill('32');
  await page.getByLabel('Convert to').selectOption('png');
  await expect(page.getByLabel('Output quality')).toHaveCount(0);
  await page.getByLabel('Output file name').fill('resized');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'resized.png', exact: true })).toBeVisible();
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click();
  const bytes = readFileSync((await (await promise).path())!);
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([64, 32]);
  expect(await page.evaluate(() => (window as unknown as { encoderCalls: unknown[] }).encoderCalls)).toEqual([{ type: 'image/png', quality: undefined, width: 64, height: 32 }]);
  await expect(page.locator('.dimensions')).toContainText('128 × 96');
  await expect(page.locator('.dimensions')).toContainText('64 × 32');
  const chooseAgain = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Convert again', exact: true }).click();
  await (await chooseAgain).setFiles('tests/fixtures/demo.png');
  await expect(page.locator('.queue-row')).toHaveCount(1);
  await page.getByLabel('Convert to').selectOption('webp');
  await page.getByLabel('Output quality').fill('10');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'resized.webp', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { encoderCalls: { type: string; quality?: number }[] }).encoderCalls.at(-1)?.quality)).toBe(.1);
});

test('download-all naming stays unique when completed tasks are removed mid-download', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  const buffer = readFileSync('tests/fixtures/demo.csv');
  await page.locator('input[type=file]').setInputFiles(['a.csv', 'b.csv', 'c.csv'].map(name => ({ name, mimeType: 'text/csv', buffer })));
  await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(3);
  for (const name of ['a.csv', 'b.csv', 'c.csv']) { await page.getByRole('button', { name: `Select ${name}`, exact: true }).click(); await page.getByLabel('Output file name').fill('shared'); }
  await page.getByRole('button', { name: 'Convert all ready files', exact: true }).click();
  await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(3);
  const names: string[] = []; page.on('download', download => names.push(download.suggestedFilename()));
  const first = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download all', exact: true }).click(); await first;
  await page.getByRole('button', { name: 'Remove a.csv', exact: true }).click();
  await expect.poll(() => names).toEqual(['shared.json', 'shared (1).json', 'shared (2).json']);
});

test('EXIF-rotated JPEG keeps its displayed aspect ratio and strips metadata', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  const url = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 4; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#137ac2'; ctx.fillRect(0, 0, 8, 4); return canvas.toDataURL('image/jpeg'); });
  const jpeg = Buffer.from(url.split(',')[1]!, 'base64'), metadata = Buffer.from('45786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  const marker = Buffer.alloc(4); marker[0] = 255; marker[1] = 225; marker.writeUInt16BE(metadata.length + 2, 2);
  const buffer = Buffer.concat([jpeg.subarray(0, 2), marker, metadata, jpeg.subarray(2)]);
  await page.locator('input[type=file]').setInputFiles({ name: 'rotated.jpg', mimeType: 'image/jpeg', buffer });
  await page.getByRole('button', { name: 'Image tools', exact: true }).click();
  await expect(page.getByLabel('Width (px)', { exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('8');
  await page.getByLabel('Convert to').selectOption('png');
  await page.getByLabel('Width (px)', { exact: true }).fill('2');
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('4');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click();
  const bytes = readFileSync((await (await download).path())!);
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2, 4]);
  expect(bytes.includes(Buffer.from('Exif'))).toBe(false);
  await expect(page.locator('.dimensions')).toContainText('4 × 8');
});

for (const language of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${language} ${theme}: workspace, mobile panels, queue persistence and local drag`, async ({ page }) => {
    const zh = language === 'zh-CN';
    await page.addInitScript(locale => Object.defineProperty(navigator, 'languages', { value: [locale] }), language);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
    await page.getByLabel(zh ? '外观主题' : 'Color theme').selectOption(theme);
    await page.screenshot({ path: `docs/phase2/screenshots/${language}-${theme}-desktop-empty.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: `docs/phase2/screenshots/${language}-${theme}-mobile-empty.png`, fullPage: true });
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/demo.csv', 'tests/fixtures/demo.png']);
    await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(2);
    await page.screenshot({ path: `docs/phase2/screenshots/${language}-${theme}-mobile-settings.png`, fullPage: true });
    await page.getByLabel(zh ? '界面语言' : 'Interface language').selectOption(zh ? 'en' : 'zh-CN');
    await page.getByLabel(zh ? 'Color theme' : '外观主题').selectOption(theme === 'light' ? 'dark' : 'light');
    await expect(page.locator('.queue-row')).toHaveCount(2);
    await page.getByLabel(zh ? 'Interface language' : '界面语言').selectOption(language);
    await page.getByLabel(zh ? '外观主题' : 'Color theme').selectOption(theme);
    await page.getByRole('button', { name: zh ? '转换所有待处理文件' : 'Convert all ready files', exact: true }).click();
    await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: zh ? '转换结果' : 'Results', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.source-preview')).toContainText('Alice');
    await page.screenshot({ path: `docs/phase2/screenshots/${language}-${theme}-mobile-result.png`, fullPage: true });
    await page.getByRole('tab', { name: zh ? '转换结果' : 'Results', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: zh ? '转换设置' : 'Settings', exact: true })).toBeFocused();
    await expect(page.locator('.settings-panel')).toContainText(zh ? '源文件已释放' : 'Source released');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `docs/phase2/screenshots/${language}-${theme}-desktop-completed.png`, fullPage: true });
    await page.getByRole('link', { name: zh ? '支持格式' : 'Formats', exact: true }).click();
    await expect(page.locator('.workbench')).toHaveCount(0);
    await page.getByRole('link', { name: zh ? '转换工具' : 'Converter', exact: true }).click();
    await expect(page.locator('.queue-row')).toHaveCount(2);
    const dt = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(['name,score\nTest,1'], 'more.csv', { type: 'text/csv' })); return data; });
    await page.locator('.workbench').dispatchEvent('dragenter', { dataTransfer: dt });
    await expect(page.locator('.bench-drop-overlay')).toBeVisible();
    await page.locator('.workbench').dispatchEvent('drop', { dataTransfer: dt }); await dt.dispose();
    await expect(page.locator('.queue-row')).toHaveCount(3);
    for (const width of [375, 600, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} ${theme} ${width}`).toBe(true); }
  });
}

test('language and theme switches preserve running batch, clear aborts and never resurrects results', async ({ page }) => {
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docx.worker-*.js', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/demo.docx', 'tests/fixtures/demo.pdf', 'tests/fixtures/demo.csv']);
    await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Convert all ready files', exact: true }).click();
    await expect(page.locator('.queue-row[data-status=processing]')).toHaveCount(1);
    await expect(page.locator('.queue-row[data-status=queued]')).toHaveCount(1);
    await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(1);
    await page.screenshot({ path: 'docs/phase2/screenshots/desktop-processing.png', fullPage: true });
    await page.getByLabel('Interface language').selectOption('zh-CN');
    await page.getByLabel('外观主题').selectOption('dark');
    await expect(page.locator('.queue-row')).toHaveCount(3);
    await expect(page.getByLabel('转换进度', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '清除全部', exact: true }).click(); release();
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
    await page.getByRole('button', { name: '开始转换', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'demo.json', exact: true })).toBeVisible();
    await expect(page.locator('.queue-row')).toHaveCount(1);
  } finally { release(); }
});
