// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPdf } from '../../src/converters/pdf/extract';

const bytes = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
describe('PDF local extraction', () => {
  it('extracts page-organized plain text', async () => {
    const result = await extractPdf(bytes('demo.pdf'), 'txt');
    expect(result.text).toContain('FileFlow Demo PDF');
    expect(result.text).toContain('This is fictional sample content.');
    expect(result.pages).toBe(1);
  });
  it('recognizes basic headings in Markdown', async () => {
    expect((await extractPdf(bytes('demo.pdf'), 'md')).text).toContain('# FileFlow Demo PDF');
  });
  it('rejects no-text PDFs with an honest OCR explanation', async () => {
    await expect(extractPdf(bytes('no-text.pdf'), 'md')).rejects.toThrow('OCR');
  });
  it('rejects corrupt PDFs without raw stack traces', async () => {
    await expect(extractPdf(bytes('corrupt.pdf'), 'txt')).rejects.toThrow('PDF');
  });
});
