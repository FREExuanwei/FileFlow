export const P5_ERROR_CODES = ['input','type','utf8','size','structure','rows','columns','output','budget','timeout','cancel','stale','security','headers','precision','date-display','asset-unavailable','json-duplicate-key'] as const;
export type P5ErrorCode = typeof P5_ERROR_CODES[number];
export class P5Error extends Error {
  constructor(readonly code: P5ErrorCode) { super(code); this.name = 'P5Error'; }
}
export function errorCode(error: unknown): P5ErrorCode {
  return error instanceof P5Error ? error.code : error instanceof DOMException && error.name === 'AbortError' ? 'cancel' : 'structure';
}
