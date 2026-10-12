import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { docxHtmlToResult } from '../../src/converters/docx/convert';
import mammoth from 'mammoth/mammoth.browser.js';
import { validateDocxArchive } from '../../src/core/files/zip';

const demo = () => { const bytes = readFileSync('tests/fixtures/demo.docx'); const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes); return buffer; };
async function convertDocx(buffer: ArrayBuffer, format: 'md' | 'txt') {
  validateDocxArchive(buffer);
  return docxHtmlToResult((await mammoth.convertToHtml({ arrayBuffer: buffer })).value, format);
}
describe('DOCX semantic extraction', () => {
  it('keeps headings, bold, list and a simple table in Markdown', async () => {
    const result = await convertDocx(demo(), 'md');
    expect(result.text).toContain('# FileFlow Demo Document');
    expect(result.text).toContain('## Section One');
    expect(result.text).toContain('**Bold sample**');
    expect(result.text).toContain('Fictional list item');
    expect(result.text).toContain('| Name | Score |');
  });
  it('extracts readable plain text', async () => {
    expect((await convertDocx(demo(), 'txt')).text).toContain('This file contains fictional test data.');
  });
  it('rejects corrupt DOCX', async () => {
    await expect(convertDocx(new TextEncoder().encode('corrupt').buffer, 'md')).rejects.toThrow('DOCX');
  });
});
