import type { ConversionOptions } from '../../core/conversion/types';
import { imageDimensions, validateDimensions } from './dimensions';
import { resizeDimensions } from './resize';
import {imageHeader} from '../../core/files/policy';

export async function convertImage(blob: Blob, input: 'png' | 'jpeg' | 'webp', output: 'png' | 'jpeg' | 'webp', options: ConversionOptions) {
  options.signal?.throwIfAborted();
  // Inspect dimensions before decoding or allocating a canvas.
  const original = imageDimensions(new Uint8Array(await imageHeader(blob)), input);
  const planned=resizeDimensions(original.width, original.height, options.resize?.width, options.resize?.height, options.resize?.keepAspect ?? true);
  if (output !== 'png' && options.quality !== undefined && (!Number.isFinite(options.quality) || options.quality < 0.1 || options.quality > 1)) throw new Error('Image quality must be between 10% and 100%.');
  options.signal?.throwIfAborted();
  // Account for decoded pixels, output canvas and a bounded encoding margin.
  // The browser/OS process working set remains an independently measured limit.
  const bytes=(w:number,h:number,outW:number,outH:number)=>w*h*4+outW*outH*4+32*1024**2;
  const lease=options.resourceBudget?.reserve('transient',bytes(original.width,original.height,planned.width,planned.height),'image-conversion');
  let bitmap: ImageBitmap|undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    try { bitmap = await createImageBitmap(blob); } catch { throw new Error('Unable to decode this image. It may be damaged or unsupported by your browser.'); }
    options.signal?.throwIfAborted();
    validateDimensions(bitmap.width, bitmap.height);
    const dimensions = resizeDimensions(bitmap.width, bitmap.height, options.resize?.width, options.resize?.height, options.resize?.keepAspect ?? true);
    lease?.resize(bytes(bitmap.width,bitmap.height,dimensions.width,dimensions.height));
    canvas = document.createElement('canvas'); canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not allocate an image canvas. Try a smaller image.');
    if (output === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    const mime = `image/${output}`;
    const quality = Math.min(1, Math.max(0.1, options.quality ?? 0.85));
    const result = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed. Try a smaller image.')), mime, output === 'png' ? undefined : quality));
    if (result.type !== mime) throw new Error(`Your browser does not support ${output.toUpperCase()} encoding.`);
    options.signal?.throwIfAborted();
    return { blob: result, dimensions, originalDimensions: { width: bitmap.width, height: bitmap.height } };
  } finally { bitmap?.close(); if (canvas) { canvas.width = 0; canvas.height = 0; } lease?.release(); }
}
