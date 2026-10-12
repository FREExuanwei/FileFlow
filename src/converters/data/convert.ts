import type { ConversionOptions } from '../../core/conversion/types';
export function convertDataInWorker(id: string, text: string, options: ConversionOptions): Promise<string> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/data.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Conversion cancelled.', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Data conversion timed out. Try a smaller file.')); }, 60000);
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ text?: string; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.text ?? '');
    };
    worker.onerror = () => { cleanup(); reject(new Error('The local data worker could not start. Reload and try again.')); };
    worker.postMessage({ id, text });
  });
}
