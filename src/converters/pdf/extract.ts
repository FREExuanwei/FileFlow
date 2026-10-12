import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { ConversionOptions } from '../../core/conversion/types';
import type { ExtractedPage } from '../../core/ai-ready/types';
import { AiError } from '../../core/ai-ready/types';

export async function extractPdf(data: Uint8Array, format: 'md' | 'txt', options: ConversionOptions & { assetBase?: string } = {}): Promise<{ text: string; pages: number; warnings: string[] }> {
  const result = await extractPdfPages(data, format, options);
  return { text: result.pages.map(page => page.markdown).join(format === 'md' ? '\n\n---\n\n' : '\n\n\f\n\n') + '\n', pages: result.pages.length, warnings: result.warnings };
}
export async function extractPdfPages(data: Uint8Array, format: 'md' | 'txt', options: ConversionOptions & { assetBase?: string; maxTextUnits?:number } = {}): Promise<{ pages: ExtractedPage[]; warnings: string[] }> {
  options.signal?.throwIfAborted();
  const assets = options.assetBase;
  const task = getDocument({ data, useSystemFonts: false, disableFontFace: true, stopAtErrors: true,
    ...(assets ? { cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` } : {}), verbosity: 0 });
  const abort = () => { void task.destroy(); };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 500) throw new Error('PDF exceeds the 500-page browser safety limit.');
    const pages: ExtractedPage[] = [];
    let blank = 0, textUnits = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      options.signal?.throwIfAborted();
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is TextItem => 'str' in item && !!item.str.trim());
      const sizes = items.map(item => Math.abs(item.transform[3] ?? item.height)).filter(Boolean).sort((a,b) => a-b);
      const bodySize = sizes[0] ?? 12;
      const lines: { text: string; y: number; size: number; x: number; end: number }[] = [];
      for (const item of items) {
        const y = item.transform[5] ?? 0, x = item.transform[4] ?? 0, size = Math.abs(item.transform[3] ?? item.height);
        const last = lines.at(-1);
        if (last && Math.abs(last.y - y) < Math.max(2, size * 0.25) && x >= last.x && x - last.end < size * 5) {
          last.text += `${x - last.end > size * 0.15 && !last.text.endsWith(' ') ? ' ' : ''}${item.str}`;
          last.end = x + item.width; last.size = Math.max(last.size, size);
        } else lines.push({ text: item.str, y, x, end: x + item.width, size });
      }
      const output: string[] = [];
      lines.forEach((line, i) => {
        const previous = lines[i - 1];
        const heading = format === 'md' && line.text.length < 160 && line.size >= bodySize * 1.3;
        if (i && (heading || Math.abs((previous?.y ?? 0) - line.y) > bodySize * 1.7)) output.push('');
        const safeText = format === 'md' ? line.text.replace(/([\\`*_{}[\]<>#])/g, '\\$1') : line.text;
        output.push(`${heading ? (line.size >= bodySize * 1.8 ? '# ' : '## ') : ''}${safeText.trim()}`);
        if (heading) output.push('');
      });
      const text = output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (!text) blank++;
      textUnits += (text || `[Page ${number}: no extractable text]`).length;
      if(options.maxTextUnits!==undefined&&textUnits>options.maxTextUnits)throw new AiError('text-limit');
      let cursor = 0;
      const mapped = lines.map(line => {
        const safeText = (format === 'md' ? line.text.replace(/([\\`*_{}[\]<>#])/g, '\\$1') : line.text).trim();
        const start = text.indexOf(safeText, cursor); cursor = start + safeText.length;
        return { text: safeText, start, end: cursor, y: line.y, fontSize: line.size, ...(format === 'md' && line.text.length < 160 && line.size >= bodySize * 1.3 ? { headingLevel: line.size >= bodySize * 1.8 ? 1 : 2 } : {}) };
      });
      pages.push({ number, markdown: text || `[Page ${number}: no extractable text]`, lines: mapped, height: page.getViewport({ scale: 1 }).height, blank: !text });
      page.cleanup();
      options.onProgress?.(number / pdf.numPages);
      // Page assembly also yields between pages, in addition to PDF.js's worker.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    if (blank === pdf.numPages) throw new Error('This PDF appears to contain scanned pages or images. OCR support is planned for a later FileFlow version.');
    return { pages, warnings: blank ? [`${blank} page(s) have no extractable text. Scanned content was not converted.`] : [] };
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Conversion cancelled.', 'AbortError');
    if (error instanceof AiError || error instanceof Error && /OCR|500-page/.test(error.message)) throw error;
    throw new Error('Unable to read this PDF. It may be damaged or password protected.', { cause: error });
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}
