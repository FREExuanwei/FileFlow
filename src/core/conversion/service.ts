import { detectFormat } from '../files/detect';
import { converters } from '../registry';
import type { ConversionOptions, InputFile } from './types';

export async function convertFile(file: InputFile, converterId: string, options: ConversionOptions = {}) {
  options.signal?.throwIfAborted();
  const format = await detectFormat(file);
  const converter = converters.find(item => item.id === converterId && item.input === format);
  if (!converter) throw new Error('This conversion is not supported for the selected file.');
  options.onProgress?.(0.05);
  const result = await converter.convert(file, options);
  options.signal?.throwIfAborted();
  options.onProgress?.(1);
  return result;
}
