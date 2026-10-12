import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const unexpected: string[] = [];
  page.on('request', request => { if (request.url().startsWith('http') && (!request.url().startsWith('http://127.0.0.1:4174/') || request.method() !== 'GET')) unexpected.push(`${request.method()} ${request.url()}`); });
  await page.exposeFunction('fileflowNetworkCheck', () => unexpected);
});
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) expect(await page.evaluate(() => (window as unknown as { fileflowNetworkCheck: () => Promise<string[]> }).fileflowNetworkCheck())).toEqual([]);
});

test('simplified Chinese default and language switch preserve an active conversion result', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['zh-CN'] }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: '选择文件', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
  await page.getByRole('button', { name: '开始转换', exact: true }).click();
  await expect(page.getByText('demo.json', { exact: true })).toBeVisible();
  await page.getByLabel('界面语言').selectOption('en');
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
  await expect(page.locator('.source-preview')).toContainText('Alice');
  expect(await page.evaluate(() => localStorage.getItem('fileflow.language'))).toBe('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

for (const language of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark', 'system'] as const) {
  test(`${language} ${theme}: visual states, responsive layout and keyboard`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(locale => Object.defineProperty(navigator, 'languages', { value: [locale] }), language);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    const chinese = language === 'zh-CN';
    const themeLabel = chinese ? '外观主题' : 'Color theme';
    await page.getByLabel(themeLabel).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noOverflow();
    await page.screenshot({ path: `test-results/ui-${language}-${theme}-desktop.png`, fullPage: true, animations: 'disabled' });
    const drag = await page.evaluateHandle(() => new DataTransfer());
    await page.locator('.dropzone').dispatchEvent('dragenter', { dataTransfer: drag });
    await expect(page.locator('.dropzone')).toHaveClass(/dragging/);
    await expect(page.getByRole('heading', { name: chinese ? '松开以导入文件' : 'Release to import your files' })).toBeVisible();
    await page.locator('.dropzone').screenshot({ path: `test-results/ui-${language}-${theme}-drag.png`, animations: 'disabled' });
    await page.locator('.dropzone').dispatchEvent('dragleave', { dataTransfer: drag });
    await drag.dispose();
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
    await expect(page.locator('.workspace')).toHaveClass(/data/);
    for (const width of [768, 375]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(); }
    await page.screenshot({ path: `test-results/ui-${language}-${theme}-workspace-mobile.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: chinese ? '开始转换' : 'Convert file', exact: true }).click();
    await expect(page.getByRole('button', { name: chinese ? '下载文件' : 'Download', exact: true })).toBeVisible();
    await expect(page.locator('.success-header')).toContainText(chinese ? '转换完成' : 'Conversion complete');
    await expect(page.getByRole('heading', { name: 'demo.json', exact: true })).toBeFocused();
    await noOverflow();
    await page.screenshot({ path: `test-results/ui-${language}-${theme}-result-mobile.png`, fullPage: true, animations: 'disabled' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: chinese ? '再次转换' : 'Convert again', exact: true }).click();
    await (await chooser).setFiles('tests/fixtures/demo.csv');
    await expect(page.getByRole('tab', { name: chinese ? '转换设置' : 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: chinese ? '开始转换' : 'Convert file', exact: true }).click();
    await expect(page.locator('.source-preview')).toContainText('Alice');
    await expect(page.locator('.queue-row')).toHaveCount(1);
    await page.getByRole('tab', { name: chinese ? '转换设置' : 'Settings', exact: true }).click();
    await page.getByRole('button', { name: chinese ? '清除文件' : 'Clear file', exact: true }).click();
    await page.getByRole('link', { name: chinese ? '支持格式' : 'Formats', exact: true }).click();
    await expect(page.locator('.format-card')).toHaveCount(4);
    await expect(page.locator('.format-route')).toHaveCount(9);
    await noOverflow();
    await page.locator('#formats').screenshot({ path: `test-results/ui-${language}-${theme}-formats-mobile.png`, animations: 'disabled' });
    await page.getByRole('button', { name: chinese ? '隐私保护' : 'Privacy', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(chinese ? '手动选择的语言' : 'manual language');
    await page.getByRole('button', { name: chinese ? '知道了' : 'Got it', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: chinese ? '关闭隐私说明' : 'Close privacy details' })).toBeFocused();
    await page.screenshot({ path: `test-results/ui-${language}-${theme}-privacy-mobile.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: chinese ? '隐私保护' : 'Privacy', exact: true })).toBeFocused();
    await page.setViewportSize({ width: 768, height: 1024 }); await noOverflow();
    await page.screenshot({ path: `test-results/ui-${language}-${theme}-tablet.png`, fullPage: true, animations: 'disabled' });
    if (theme === 'system') {
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(['fileflow-theme']);
  });
}

test('Chinese error and warning states, limits and task notices', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['zh'] }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.exe', mimeType: '', buffer: Buffer.from('fictional') });
  await expect(page.getByRole('alert')).toContainText('暂不支持这个文件类型');
  await page.getByRole('button', { name: '清除全部', exact: true }).click();
  await page.screenshot({ path: 'test-results/ui-zh-error-mobile.png', fullPage: true, animations: 'disabled' });
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/no-text.pdf');
  await page.getByRole('button', { name: '开始转换', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('当前版本暂不支持 OCR');
  await page.getByRole('button', { name: '清除文件', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'fictional-large.csv', mimeType: 'text/csv', buffer: Buffer.from('name,score\nAlice,95\n' + ' '.repeat(6 * 1024 ** 2)) });
  await expect(page.locator('.notice')).toContainText('这个文件较大');
  await page.screenshot({ path: 'test-results/ui-zh-warning-mobile.png', fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '清除文件', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad}') });
  await page.getByRole('button', { name: '开始转换', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JSON 格式无效');
  await page.getByLabel('界面语言').selectOption('en');
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
});

test('changing language during conversion preserves task and cancel translates immediately', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['zh-CN'] }));
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/docx.worker-*.js', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.docx');
    await page.getByRole('button', { name: '开始转换', exact: true }).click();
    await expect(page.getByLabel('转换进度', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-zh-converting.png', fullPage: true, animations: 'disabled' });
    await page.getByLabel('界面语言').selectOption('en');
    await expect(page.getByLabel('Conversion progress', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'demo.docx', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel conversion' }).click();
    await expect(page.locator('.information')).toContainText('Conversion cancelled');
    await page.getByLabel('Interface language').selectOption('zh-CN');
    await expect(page.locator('.information')).toContainText('转换已取消');
  } finally { release(); }
});

test('document preview follows app theme and preserves its strict sandbox', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.md');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  for (const theme of ['dark', 'light'] as const) {
    await page.getByLabel('Color theme').selectOption(theme);
    await expect(page.frameLocator('iframe').locator('html')).toHaveCSS('color-scheme', theme);
  }
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('');
  expect(await page.locator('iframe').getAttribute('srcdoc')).toContain("connect-src 'none'");
});

test('light and dark text tokens meet basic contrast targets', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark'] as const) {
    await page.getByLabel('Color theme').selectOption(theme);
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const color = (name: string) => {
        const raw = style.getPropertyValue(name).trim().slice(1);
        const value = raw.length === 3 ? [...raw].map(character => character + character).join('') : raw;
        return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      };
      const luminance = (name: string) => { const values = color(name); return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722; };
      const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return ['--bg', '--surface', '--soft', '--elevated'].flatMap(background => ['--text', '--muted'].map(text => ({ pair: `${text}/${background}`, value: ratio(text, background) }))).concat(['document', 'image', 'data', 'markup', 'success', 'warning', 'error', 'info'].map(name => ({ pair: name, value: ratio(`--${name}`, `--${name}-soft`) })));
    });
    for (const { pair, value } of ratios) expect(value, `${theme} ${pair}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('Chinese DOCX details and metadata translate fully, then clear restores browse focus', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['zh-CN'] }));
  await page.goto('/');
  await expect(page.locator('#formats')).not.toContainText('Word document');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.docx');
  await expect(page.locator('.file-summary p')).toContainText('DOCX');
  await expect(page.locator('.limitations')).toContainText('80 MB');
  await expect(page.locator('.description')).toContainText('Word 文档');
  await page.getByRole('button', { name: '清除文件', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择文件', exact: true })).toBeFocused();
});

test('headers fit intermediate breakpoints in both languages', async ({ page }) => {
  await page.goto('/');
  for (const language of ['zh-CN', 'en']) {
    await page.locator('.language-picker select').selectOption(language);
    for (const width of [600, 601, 620, 650, 700, 800, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} ${width}`).toBe(true);
      await expect(page.locator('.language-picker')).toBeInViewport();
      await expect(page.locator('.theme-picker')).toBeInViewport();
    }
  }
});

test('language remains usable when preference storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN'] });
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '选择文件', exact: true })).toBeVisible();
  await page.getByLabel('界面语言').selectOption('en');
  await expect(page.getByRole('button', { name: 'Browse files', exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.csv');
  await page.getByRole('button', { name: 'Convert file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
});
