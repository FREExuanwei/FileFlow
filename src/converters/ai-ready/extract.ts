import { detectFormat, validateSize } from '../../core/files/detect';
import type { InputFile, ConversionOptions } from '../../core/conversion/types';
import { AiError, type AiFormat, type ExtractedDocument } from '../../core/ai-ready/types';
import { checkText, TEXT_LIMIT } from '../../core/ai-ready/limits';
import { htmlToMarkdown } from '../markup/transform';
import { extractDocxInWorker } from '../docx/worker';

export async function detectAiFormat(file: InputFile): Promise<AiFormat> {
  if (!file.size) throw new AiError('empty-input');
  // Desktop ordinary/OCR PDF admission is separate from this frozen pipeline.
  if(/\.pdf$/i.test(file.name)&&file.size>40*1024**2)throw new AiError('input-limit');
  if (/\.txt$/i.test(file.name)) {
    if (file.type && !['text/plain','application/octet-stream'].includes(file.type.split(';')[0]!.toLowerCase())) throw new AiError('invalid-mime');
    if (file.size > 10 * 1024 ** 2) throw new AiError('input-limit');
    return 'txt';
  }
  try {
    const format = await detectFormat(file);
    if (!['pdf','docx','md','html'].includes(format)) throw new AiError('unsupported');
    validateSize(file.size,format); return format as AiFormat;
  } catch (error) {
    if (error instanceof AiError) throw error;
    const message = error instanceof Error ? error.message : '';
    throw new AiError(/exceeds/.test(message) ? 'input-limit' : /MIME/.test(message) ? 'invalid-mime' : /signature/.test(message) ? 'invalid-signature' : 'unsupported');
  }
}
export async function extractAiDocument(file: InputFile, options: ConversionOptions): Promise<ExtractedDocument> {
  options.signal?.throwIfAborted(); const format = await detectAiFormat(file);
  try {
    if (format === 'pdf') {
      const [{ extractPdfPages }, { GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([import('../pdf/extract'),import('pdfjs-dist/legacy/build/pdf.mjs'),import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]);
      GlobalWorkerOptions.workerSrc = workerUrl;
      const result = await extractPdfPages(new Uint8Array(await file.blob.arrayBuffer()),'md',{ ...options, maxTextUnits:TEXT_LIMIT, assetBase: new URL(`${import.meta.env.BASE_URL}pdf-assets/`,document.baseURI).href });
      const length = result.pages.reduce((sum,p) => sum+p.markdown.length,0); if (length > 16 * 1024 ** 2) throw new AiError('text-limit');
      return { sourceFormat:format,pages:result.pages,warnings:result.warnings.length ? [{code:'blank-pages',count:result.pages.filter(p => p.blank).length}] : [{code:'extraction-limits'}] };
    }
    let text: string; const warnings: ExtractedDocument['warnings'] = [];
    if (format === 'docx') {
      const result = await extractDocxInWorker(await file.blob.arrayBuffer(),options);
      text = htmlToMarkdown(result.html,{preserveCodeLanguage:true}); warnings.push({code:'extraction-limits'});
    } else {
      try { text = new TextDecoder('utf-8',{fatal:true}).decode(await file.blob.arrayBuffer()); } catch { throw new AiError('invalid-encoding'); }
      if (format === 'html') text = htmlToMarkdown(text,{preserveCodeLanguage:true});
    }
    options.signal?.throwIfAborted(); checkText(text);
    return { sourceFormat:format,pages:[{number:1,markdown:text,lines:[],blank:!text.trim()}],warnings };
  } catch (error) {
    if (options.signal?.aborted) throw new AiError('cancelled');
    if (error instanceof AiError) throw error;
    throw new AiError(error instanceof Error && /OCR/.test(error.message) ? 'scanned-pdf' : 'damaged-document');
  }
}
