import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { extractPdf } from './extract';
import type { ConversionOptions } from '../../core/conversion/types';

GlobalWorkerOptions.workerSrc = workerUrl;
export async function convertPdf(blob: Blob, format: 'md' | 'txt', options: ConversionOptions) {
  options.signal?.throwIfAborted();
  const lease=options.resourceBudget?.reserve('transient',blob.size+64*1024**2,'pdf-conversion');
  try{
    const data = new Uint8Array(await blob.arrayBuffer());
    options.signal?.throwIfAborted();
    const assetBase = new URL(`${import.meta.env.BASE_URL}pdf-assets/`, document.baseURI).href;
    return await extractPdf(data, format, { ...options, assetBase });
  }finally{lease?.release();}
}
