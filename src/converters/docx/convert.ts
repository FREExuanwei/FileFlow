import { htmlToMarkdown, sanitizeHtml } from '../markup/transform';
import { extractDocxInWorker } from './worker';
import type { ConversionOptions } from '../../core/conversion/types';

export async function convertDocx(buffer: ArrayBuffer, format: 'md' | 'txt', options: ConversionOptions = {}): Promise<{ text: string; warnings: string[] }> {
  const result = await extractDocxInWorker(buffer, options);
  options.signal?.throwIfAborted();
  return docxHtmlToResult(result.html, format, result.warnings);
}
export function docxHtmlToResult(html: string, format: 'md' | 'txt', warnings: string[] = []): { text: string; warnings: string[] } {
    const clean = sanitizeHtml(html);
    let text: string;
    if (format === 'md') text = htmlToMarkdown(clean);
    else {
      const doc = new DOMParser().parseFromString(clean, 'text/html');
      for (const row of doc.querySelectorAll('tr')) row.append('\n');
      for (const cell of doc.querySelectorAll('td, th')) cell.append('\t');
      for (const node of doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,br')) node.append('\n');
      text = (doc.body.textContent ?? '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
    if (!text.trim()) throw new Error('DOCX contains no readable text.');
    return { text, warnings };
}
