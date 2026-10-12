import type { Category, Converter, Format } from '../conversion/types';
import { formats } from '../files/detect';
import { safeOutputName } from '../files/names';
import { htmlToMarkdown, markdownToHtml } from '../../converters/markup/transform';

const definitions: { input: Format; outputs: Format[]; category: Category; description: string; limitations: string[] }[] = [
  { input: 'pdf', outputs: ['md','txt'], category: 'Document', description: 'Extract readable content from a text-based PDF.', limitations: ['Text-based PDFs only. Scanned pages need OCR, planned for later.', 'Content extraction: layout, tables, reading order and formulas may change. Maximum 500 pages.'] },
  { input: 'docx', outputs: ['md','txt'], category: 'Document', description: 'Turn Word documents into clean, readable content.', limitations: ['Semantic text, headings, lists and simple tables. Complex layout, images, equations and merged tables are not preserved.', 'Up to 10 MB; expanded ZIP limited to 80 MB.'] },
  { input: 'md', outputs: ['html'], category: 'Markup', description: 'Render Markdown as safe, semantic HTML.', limitations: ['Raw HTML is escaped. Images and active content are removed for privacy.'] },
  { input: 'html', outputs: ['md'], category: 'Markup', description: 'Convert semantic HTML into clean Markdown.', limitations: ['Scripts, styles, embeds and images are removed. Merged tables become readable text.'] },
  { input: 'csv', outputs: ['json'], category: 'Data', description: 'Convert comma-separated rows into JSON objects.', limitations: ['UTF-8 comma-separated CSV with unique headers. Values remain strings. Up to 100,000 rows.'] },
  { input: 'json', outputs: ['csv'], category: 'Data', description: 'Export a JSON array as a spreadsheet-friendly CSV.', limitations: ['Arrays of flat objects only. Up to 100,000 rows and 1,000 columns. Missing and null values become empty cells.', 'Spreadsheet formula strings (including headers) receive a protective apostrophe.'] },
  ...(['png','jpeg','webp'] as const).map(input => ({ input, outputs: (['png','jpeg','webp'] as const).filter(output => output !== input), category: 'Image' as const, description: 'Re-encode images locally using your browser.', limitations: ['Original dimensions retained; maximum 24 megapixels. Metadata is discarded.', 'JPEG replaces transparency with white. Animated images export their first frame.'] })),
];

export const converters: Converter[] = definitions.flatMap(definition => definition.outputs.map(output => ({
  id: `${definition.input}-to-${output}`, displayName: formats[output].label, input: definition.input, output,
  inputMime: formats[definition.input].mime, outputMime: formats[output].mime,
  inputExtensions: formats[definition.input].extensions, outputExtension: output === 'jpeg' ? 'jpg' : output,
  category: definition.category, description: definition.description, preview: true,
  lossy: ['jpeg','webp'].includes(output) || ['pdf','docx','html'].includes(definition.input), limitations: definition.limitations,
  async convert(file, options) {
    options.signal?.throwIfAborted();
    const input = definition.input;
    const name = safeOutputName(file.name, output === 'jpeg' ? 'jpg' : output);
    if (input === 'png' || input === 'jpeg' || input === 'webp') {
      const { convertImage } = await import('../../converters/image/convert');
      const result = await convertImage(file.blob, input, output as 'png' | 'jpeg' | 'webp', options);
      return { ...result, name, format: output, warnings: [] };
    }
    let text: string; let warnings: string[] = []; let pages: number | undefined;
    if (input === 'pdf') {
      const { convertPdf } = await import('../../converters/pdf/convert');
      const result = await convertPdf(file.blob, output as 'md' | 'txt', options);
      text = result.text; warnings = result.warnings; pages = result.pages;
    } else if (input === 'docx') {
      const { convertDocx } = await import('../../converters/docx/convert');
      const result = await convertDocx(await file.blob.arrayBuffer(), output as 'md' | 'txt', options);
      text = result.text; warnings = result.warnings;
    } else {
      let source: string;
      try { source = new TextDecoder('utf-8', { fatal: true }).decode(await file.blob.arrayBuffer()); }
      catch { throw new Error('This file is not valid UTF-8. Save it as UTF-8 and try again.'); }
      if (!source.trim()) throw new Error('This file is empty or contains only whitespace.');
      if (input === 'csv' || input === 'json') {
        const { convertDataInWorker } = await import('../../converters/data/convert');
        text = await convertDataInWorker(`${input}-to-${output}`, source, options);
      } else {
        text = input === 'md' ? markdownToHtml(source) : htmlToMarkdown(source);
      }
    }
    options.signal?.throwIfAborted();
    if (!text.trim()) throw new Error('No readable content remains after safe conversion.');
    return { name, format: output, text, blob: new Blob([text], { type: `${formats[output].mime};charset=utf-8` }), warnings, pages };
  },
})));
export function convertersFor(format: Format): Converter[] { return converters.filter(converter => converter.input === format); }
