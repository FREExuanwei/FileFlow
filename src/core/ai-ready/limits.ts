import { AiError } from './types';
export const TEXT_LIMIT = 16 * 1024 ** 2;
export const CHUNK_LIMIT = 2000;
export function checkText(text: string) { if (text.length > TEXT_LIMIT) throw new AiError('text-limit'); }
