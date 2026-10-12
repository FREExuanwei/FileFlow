import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

// A text page and a blank page exercise the real PDF warning path; no personal content.
function fictionalMixedPdf() {
  const stream = 'BT /F1 18 Tf 72 750 Td (Fictional color review document) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Length 0 >>\nstream\n\nendstream'];
  let source = '%PDF-1.4\n'; const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(source)); source += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 8\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
}
async function token(page: Page, name: string) {
  return page.evaluate(value => { const element = document.createElement('span'); element.style.color = `var(${value})`; document.body.append(element); const color = getComputedStyle(element).color; element.remove(); return color; }, name);
}
async function color(locator: Locator) { return locator.evaluate(element => getComputedStyle(element).color); }

for (const language of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${language} ${theme}: category, semantic, hover and focus color roles`, async ({ page }) => {
    const chinese = language === 'zh-CN', network: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url()) && (!request.url().startsWith('http://127.0.0.1:4174/') || request.method() !== 'GET')) network.push(request.url()); });
    await page.addInitScript(locale => Object.defineProperty(navigator, 'languages', { value: [locale] }), language);
    let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/docx.worker-*.js', async route => { await gate; await route.continue().catch(() => {}); });
    try {
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
      await page.getByLabel(chinese ? '外观主题' : 'Color theme').selectOption(theme);
      await page.locator('input[type=file]').setInputFiles(['tests/fixtures/demo.pdf', 'tests/fixtures/demo.docx', 'tests/fixtures/demo.png', 'tests/fixtures/demo.csv', 'tests/fixtures/demo.json', 'tests/fixtures/demo.md', 'tests/fixtures/demo.html']);
      await page.locator('input[type=file]').setInputFiles([{ name: 'fictional-mixed.pdf', mimeType: 'application/pdf', buffer: fictionalMixedPdf() }, { name: 'fictional-invalid.json', mimeType: 'application/json', buffer: Buffer.from('{fictional invalid json}') }]);
      await expect(page.locator('.queue-row[data-status=ready]')).toHaveCount(9);
      const categoryColors = [];
      for (const [category, filename] of [['document', 'demo.pdf'], ['image', 'demo.png'], ['data', 'demo.csv'], ['markup', 'demo.md']] as const) {
        const select = page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} ${filename}`, exact: true });
        await select.click(); await expect(page.locator('.queue-row.selected')).toHaveClass(new RegExp(category));
        const expected = await token(page, `--${category}`);
        expect(await color(page.locator('.queue-row.selected .queue-file-icon'))).toBe(expected);
        expect(await color(page.locator('.queue-row.selected .queue-type-label'))).toBe(expected);
        expect(await color(page.locator('.file-type-label'))).toBe(expected);
        categoryColors.push(expected);
        await select.hover(); expect(await page.locator('.queue-row.selected').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await token(page, '--soft'));
        await page.keyboard.press('Tab'); await select.focus();
        await expect(select).toBeFocused(); expect(await select.evaluate(element => getComputedStyle(element).outlineColor)).toBe(await token(page, '--focus'));
      }
      expect(new Set(categoryColors).size).toBe(4);
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-categories-focus.png`, fullPage: true });
      await page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} demo.pdf`, exact: true }).click();
      await page.getByLabel(chinese ? '转换为' : 'Convert to').selectOption('pdf-to-txt');
      await page.getByRole('button', { name: chinese ? '转换所有待处理文件' : 'Convert all ready files', exact: true }).click();
      await expect(page.locator('.queue-row[data-status=processing] .status').first()).toHaveText(chinese ? '处理中' : 'Processing');
      expect(await color(page.locator('.queue-row[data-status=processing] .status').first())).toBe(await token(page, '--processing'));
      await page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} demo.docx`, exact: true }).click();
      await expect(page.locator('.queue-row.selected')).toHaveAttribute('data-status', 'processing');
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-processing.png`, fullPage: true });
      await page.getByRole('button', { name: chinese ? '取消转换' : 'Cancel conversion', exact: true }).click();
      await expect(page.locator('.information')).toBeVisible();
      expect(await color(page.locator('.information'))).toBe(await token(page, '--info'));
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-info.png`, fullPage: true });
      await page.getByRole('button', { name: chinese ? '重试' : 'Retry', exact: true }).click();
      release();
      await expect(page.locator('.queue-row[data-status=completed]')).toHaveCount(7);
      await expect(page.locator('.queue-row[data-status=warning]')).toHaveCount(1);
      await expect(page.locator('.queue-row[data-status=failed]')).toHaveCount(1);
      for (const [state, semantic] of [['completed', 'success'], ['warning', 'warning'], ['failed', 'error']] as const) expect(await color(page.locator(`.queue-row[data-status=${state}] .status`).first())).toBe(await token(page, `--${semantic}`));
      for (const [filename, category] of [['demo.pdf', 'document'], ['demo.png', 'image'], ['demo.csv', 'data'], ['demo.md', 'markup']] as const) {
        await page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} ${filename}`, exact: true }).click();
        await expect(page.locator('.result-format-label')).toBeVisible();
        expect(await color(page.locator('.result-format-label'))).toBe(await token(page, `--${category}`));
        expect(await color(page.locator('.success-header'))).toBe(await token(page, '--success'));
        const download = page.getByRole('button', { name: chinese ? '下载文件' : 'Download', exact: true });
        await page.mouse.move(0, 0); expect(await download.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await token(page, '--button'));
        await download.hover(); expect(await download.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await token(page, '--button-hover'));
        await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-${category}-success.png`, fullPage: true });
      }
      await page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} fictional-mixed.pdf`, exact: true }).click();
      expect(await color(page.locator('.success-header'))).toBe(await token(page, '--warning'));
      await expect(page.locator('.result-summary .notice')).toBeVisible();
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-warning.png`, fullPage: true });
      await page.getByRole('button', { name: `${chinese ? '选择' : 'Select'} fictional-invalid.json`, exact: true }).click();
      expect(await color(page.locator('.settings-panel .error'))).toBe(await token(page, '--error'));
      expect(await color(page.locator('.result-column .empty-output>svg'))).toBe(await token(page, '--error'));
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-error.png`, fullPage: true });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: `docs/phase2/color-refinement/screenshots/${language}-${theme}-mobile.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(network).toEqual([]);
    } finally { release(); }
  });
}

test('neutral layers and category/state text retain contrast in both themes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Color theme').selectOption(theme);
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      function luminance(name: string) {
        let value = style.getPropertyValue(name).trim().slice(1); if (value.length === 3) value = [...value].map(c => c + c).join('');
        const rgb = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
      }
      const pairs = ['--bg', '--surface', '--panel', '--elevated', '--soft'].flatMap(bg => ['--text', '--muted'].map(fg => [fg, bg]));
      for (const name of ['document', 'image', 'data', 'markup', 'success', 'warning', 'error', 'info', 'processing']) pairs.push([`--${name}`, `--${name}-soft`], [`--${name}`, '--surface'], [`--${name}`, '--panel']);
      return pairs.map(([fg, bg]) => { const a = luminance(fg!), b = luminance(bg!); return { pair: `${fg}/${bg}`, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }; });
    });
    for (const { pair, ratio } of ratios) expect(ratio, `${theme} ${pair}`).toBeGreaterThanOrEqual(4.5);
  }
});
