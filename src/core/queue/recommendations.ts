import type { Format } from '../conversion/types';
import { convertersFor } from '../registry';

/** Deterministic, local suggestions; every suggestion is an actual registered route. */
export function recommendations(input: Format) {
  const preferred: Partial<Record<Format, Format>> = { pdf: 'md', docx: 'md', png: 'webp', jpeg: 'webp', webp: 'png', csv: 'json', json: 'csv', md: 'html', html: 'md' };
  return convertersFor(input).slice().sort((a, b) => Number(b.output === preferred[input]) - Number(a.output === preferred[input]));
}
