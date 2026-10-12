// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { extractPdf, extractPdfPages } from '../../src/converters/pdf/extract';
const bytes = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
it('pdf_retains_page_line_geometry', async () => {
  const result = await extractPdfPages(bytes('ai-repeated.pdf'), 'md');
  expect(result.pages.map(p => p.number)).toEqual([1,2,3,4]);
  for (const page of result.pages) {
    expect(page.height).toBe(842);
    expect(page.markdown).toContain('Fictional Guide');
    expect(page.lines[0]?.y).toBe(800);
    expect(page.lines.every(l => page.markdown.slice(l.start,l.end).includes(l.text))).toBe(true);
  }
});
it('legacy_pdf_output_remains_identical', async () => {
  expect((await extractPdf(bytes('demo.pdf'),'md')).text).toBe('# FileFlow Demo PDF\n\n## Section One\n\nThis is fictional sample content.\n');
  expect((await extractPdf(bytes('demo.pdf'),'txt')).text).toBe('FileFlow Demo PDF\n\nSection One\n\nThis is fictional sample content.\n');
});
it('AI_extraction_stops_at_page_assembly_text_limit',async()=>{
  await expect(extractPdfPages(bytes('ai-repeated.pdf'),'md',{maxTextUnits:200})).rejects.toThrow('text-limit');
});
