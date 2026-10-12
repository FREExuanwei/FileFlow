import mammoth from 'mammoth/mammoth.browser.js';
import { validateDocxContent } from '../../core/files/zip';

export async function extractDocxHtml(buffer: ArrayBuffer, signal?: AbortSignal): Promise<{ html: string; warnings: string[] }> {
  await validateDocxContent(buffer, signal);
  signal?.throwIfAborted();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    externalFileAccess: false, includeEmbeddedStyleMap: false,
    convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
  });
  signal?.throwIfAborted();
  return { html: result.value, warnings: result.messages.length ? ['Some Word elements could not be represented; review the output.'] : [] };
}
