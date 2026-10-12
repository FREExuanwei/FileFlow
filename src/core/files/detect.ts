import type { Format, InputFile } from '../conversion/types';
import {fileEnvironment,fileLimitMiB} from './policy';
export const formats: Record<Format, { label: string; mime: string; extensions: string[]; limit: number }> = {
  pdf: { label: 'PDF', mime: 'application/pdf', extensions: ['pdf'], limit: 40 },
  docx: { label: 'Word document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'], limit: 10 },
  md: { label: 'Markdown', mime: 'text/markdown', extensions: ['md', 'markdown'], limit: 10 },
  txt: { label: 'Plain Text', mime: 'text/plain', extensions: ['txt'], limit: 10 },
  html: { label: 'HTML', mime: 'text/html', extensions: ['html', 'htm'], limit: 10 },
  csv: { label: 'CSV', mime: 'text/csv', extensions: ['csv'], limit: 10 },
  json: { label: 'JSON', mime: 'application/json', extensions: ['json'], limit: 10 },
  png: { label: 'PNG', mime: 'image/png', extensions: ['png'], limit: 20 },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], limit: 20 },
  webp: { label: 'WebP', mime: 'image/webp', extensions: ['webp'], limit: 20 },
};
export function validateSize(size: number, format: Format): void {
  if (!size) throw new Error('This file is empty. Choose a file with content.');
  const limit = fileLimitMiB(format);
  if (size > limit * 1024 ** 2) throw new Error(`This file exceeds the ${limit} MB ${fileEnvironment()==='desktop'?'desktop':'browser'} safety limit for ${formats[format].label}. Try a smaller file.`);
}
export async function detectFormat(file: InputFile): Promise<Format> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const format = (Object.keys(formats) as Format[]).find(key => key !== 'txt' && formats[key].extensions.includes(extension ?? ''));
  if (!format) throw new Error('Unsupported file type. Choose PDF, DOCX, Markdown, HTML, CSV, JSON, PNG, JPEG or WebP.');
  validateSize(file.size, format);
  const mime = file.type.split(';')[0]?.toLowerCase() ?? '';
  const aliases: Partial<Record<Format, string[]>> = { md: ['text/plain', 'text/x-markdown'], csv: ['text/plain', 'application/vnd.ms-excel'], json: ['text/plain'], html: ['application/xhtml+xml'], jpeg: ['image/jpg'] };
  if (mime && mime !== 'application/octet-stream' && mime !== formats[format].mime && !aliases[format]?.includes(mime)) throw new Error('The file MIME type does not match its filename. Please check the original file format.');
  if (['pdf', 'docx', 'png', 'jpeg', 'webp'].includes(format)) {
    const bytes = new Uint8Array(await file.blob.slice(0, 1024).arrayBuffer());
    const ascii = new TextDecoder('latin1').decode(bytes);
    const valid = { pdf: ascii.includes('%PDF-'), docx: bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4,
      png: [137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte), jpeg: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      webp: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP' };
    if (!valid[format as keyof typeof valid]) throw new Error('The file signature does not match its format, or the file is damaged.');
  }
  return format;
}
