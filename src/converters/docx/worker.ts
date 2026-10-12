import type { ConversionOptions } from '../../core/conversion/types';
export function extractDocxInWorker(buffer: ArrayBuffer, options: ConversionOptions): Promise<{ html: string; warnings: string[] }> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/docx.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Conversion cancelled.', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('DOCX conversion timed out. Try a smaller document.')); }, 60000);
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ html: string; warnings: string[]; error?: string }>) => {
      cleanup(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data);
    };
    worker.onerror = () => { cleanup(); reject(new Error('The local DOCX worker could not start. Use a current browser and try again.')); };
    worker.postMessage(buffer, [buffer]);
  });
}
