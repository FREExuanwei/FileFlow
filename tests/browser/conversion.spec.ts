import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  const unexpected: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith('http') && (!request.url().startsWith('http://127.0.0.1:4174/') || request.method() !== 'GET')) unexpected.push(`${request.method()} ${request.url()}`);
  });
  await page.exposeFunction('fileflowNetworkCheck', () => unexpected);
});
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) expect(await page.evaluate(async () => {
    const check = (window as unknown as { fileflowNetworkCheck: () => Promise<string[]> }).fileflowNetworkCheck;
    return check();
  })).toEqual([]);
});

test('home imports a fictional file, previews and downloads local output', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Convert files locally\./ })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
  await expect(page.getByRole('heading', { name: 'demo.csv', exact: true })).toBeVisible();
  await expect(page.getByLabel('Convert to')).toHaveValue('csv-to-json');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByText('demo.json', { exact: true })).toBeVisible();
  await expect(page.locator('.source-preview')).toContainText('Alice');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('demo.json');
  await page.getByRole('button', { name: 'Clear file' }).click();
  await expect(page.getByRole('button', { name: 'Browse files' })).toBeVisible();
});

for (const [filename, target, expected] of [
  ['demo.pdf', 'pdf-to-md', 'FileFlow Demo PDF'], ['demo.pdf', 'pdf-to-txt', 'fictional sample content'],
  ['demo.docx', 'docx-to-md', '**Bold sample**'], ['demo.docx', 'docx-to-txt', 'fictional test data'],
  ['demo.html', 'html-to-md', '# FileFlow Demo'], ['demo.md', 'md-to-html', '<h1>FileFlow Demo</h1>'],
  ['demo.json', 'json-to-csv', 'Alice,95'],
] as const) {
  test(`${filename} → ${target} works with actual browser libraries`, async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/${filename}`);
    await page.getByLabel('Convert to').selectOption(target);
    await page.getByRole('button', { name: 'Convert file', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await expect(page.locator('.source-preview')).toContainText(expected);
  });
}

test('scanned and corrupt documents show useful errors', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/no-text.pdf');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('OCR');
  await page.getByRole('button', { name: 'Clear file' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad}') });
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
});

test('hostile markup preview makes no external requests and stores no file data', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4174')) external.push(request.url()); });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'hostile.md', mimeType: 'text/markdown', buffer: Buffer.from('# Fictional\n\n<script>window.parent.hacked=true</script>\n\n![track](https://example.com/track)\n\n[x](javascript:alert(1))') });
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.locator('iframe')).toBeVisible();
  await expect(page.frameLocator('iframe').locator('body')).toContainText('Fictional');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => 'hacked' in window)).toBe(false);
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('');
});

test('PNG, JPEG and WebP convert in all six directions and strip fictional EXIF', async ({ page }) => {
  await page.goto('/');
  const png = readFileSync('tests/fixtures/demo.png');
  let jpeg: Buffer | undefined, webp: Buffer | undefined;
  for (const [name, mimeType, buffer, target] of [
    ['demo.png', 'image/png', png, 'png-to-jpeg'], ['demo.png', 'image/png', png, 'png-to-webp'],
  ] as const) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
    await page.getByLabel('Convert to').selectOption(target);
    await page.getByRole('button', { name: 'Convert file', exact: true }).click();
    await expect(page.getByText('128 × 96', { exact: true }).first()).toBeVisible();
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await promise;
    const path = await download.path();
    const output = readFileSync(path!);
    if (target === 'png-to-jpeg') jpeg = output; else webp = output;
    await page.getByRole('button', { name: 'Clear file' }).click();
  }
  // APP1 segment carries fictional metadata; never sourced from a real photograph.
  const metadata = Buffer.from('Exif\0\0FICTIONAL_GPS_SAMPLE');
  const segment = Buffer.alloc(4); segment[0] = 255; segment[1] = 225; segment.writeUInt16BE(metadata.length + 2, 2);
  const taggedJpeg = Buffer.concat([jpeg!.subarray(0, 2), segment, metadata, jpeg!.subarray(2)]);
  for (const [name, mimeType, buffer, targets] of [
    ['demo.jpeg', 'image/jpeg', taggedJpeg, ['jpeg-to-png', 'jpeg-to-webp']],
    ['demo.webp', 'image/webp', webp!, ['webp-to-png', 'webp-to-jpeg']],
  ] as const) for (const target of targets) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
    await page.getByLabel('Convert to').selectOption(target);
    await page.getByRole('button', { name: 'Convert file', exact: true }).click();
    await expect(page.locator('.image-preview img')).toBeVisible();
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const output = readFileSync((await (await promise).path())!);
    expect(output.includes(metadata)).toBe(false);
    expect(output.includes(Buffer.from('Exif\0\0'))).toBe(false);
    await page.getByRole('button', { name: 'Clear file' }).click();
  }
});

test('responsive themes and keyboard controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Browse files' }).focus();
  await expect(page.getByRole('button', { name: 'Browse files' })).toBeFocused();
  await page.screenshot({ path: 'test-results/mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Color theme').selectOption('light');
  await page.screenshot({ path: 'test-results/desktop-light.png', fullPage: true, animations: 'disabled' });
});

test('privacy dialog traps keyboard focus and restores the invoking control', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close privacy details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Privacy', exact: true })).toBeFocused();
});

test('cancelling DOCX terminates its worker and a new task cannot receive its result', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { started: 0, terminated: 0 };
    Object.assign(window, { fileflowWorkerState: state });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      private docx: boolean;
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); this.docx = String(url).includes('docx.worker'); if (this.docx) state.started++; }
      override terminate() { if (this.docx) state.terminated++; super.terminate(); }
    };
  });
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docx.worker-*.js', async route => { await gate; await route.continue().catch(() => {}); });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.docx');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { fileflowWorkerState: { started: number } }).fileflowWorkerState.started)).toBe(1);
  await page.getByRole('button', { name: 'Cancel conversion' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { fileflowWorkerState: { terminated: number } }).fileflowWorkerState.terminated)).toBe(1);
  await page.getByRole('button', { name: 'Clear file' }).click();
  release();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByText('demo.json', { exact: true })).toBeVisible();
  await expect(page.locator('.source-preview')).toContainText('Alice');
  await expect(page.getByText('demo.md', { exact: true })).not.toBeVisible();
});
