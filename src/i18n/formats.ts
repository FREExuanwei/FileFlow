import type { Format } from '../core/conversion/types';
import { formats } from '../core/files/detect';
import { translate } from './index';
import type { Language } from './types';
export function formatLabel(language: Language, format: Format): string {
  if (format === 'docx') return 'DOCX';
  if (format === 'txt') return translate(language, 'plainText');
  return formats[format].label;
}
