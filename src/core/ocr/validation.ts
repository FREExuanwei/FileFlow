import { OCR_LIMITS } from './limits';
import { OcrError, type OcrDocumentResult } from './types';

const languages = ['eng', 'chi_sim', 'chi_sim+eng'];
const qualities = ['fast', 'standard', 'high'];
const preprocessing = ['original', 'enhanced'];
const rotations = [0, 90, 180, 270];
const warningCodes = ['low-confidence', 'empty-recognition', 'uncertain-text-layer', 'missing-page', 'resolution-capped', 'layout-limitation'];
const errorCodes = ['unsupported-format', 'invalid-file', 'encrypted-pdf', 'no-pages', 'render-failed', 'ocr-engine-load-failed',
  'ocr-language-load-failed', 'page-recognition-failed', 'resource-limit', 'cancelled', 'timeout', 'offline-assets-unavailable'];
const invalid = (): never => { throw new OcrError('invalid-file'); };
const limited = (): never => { throw new OcrError('resource-limit'); };
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) return invalid();
  return value;
}
function text(value: unknown, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length < min) return invalid();
  if (value.length > max) return limited();
  return value;
}
function enumeration(value: unknown, values: readonly unknown[]) { if (!values.includes(value)) invalid(); }
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) return invalid();
  if (value.length > max) return limited();
  return value;
}
function warnings(value: unknown, pageCount: number) {
  for (const item of array(value, 600)) {
    const warning = record(item, ['code', 'pageNumber']); enumeration(warning.code, warningCodes);
    if (warning.pageNumber !== undefined) number(warning.pageNumber, 1, pageCount, true);
  }
}
function settings(value: Record<string, unknown>) {
  enumeration(value.language, languages); enumeration(value.quality, qualities);
  enumeration(value.preprocessing, preprocessing); enumeration(value.rotation, rotations);
}
function confidence(value: unknown) { if (value !== undefined) number(value, 0, 100); }
function frame(value: unknown) {
  const f = record(value, ['rasterWidth', 'rasterHeight', 'baseWidth', 'baseHeight', 'pixelToBase']);
  const width = number(f.rasterWidth, 1, OCR_LIMITS.rasterSide, true), height = number(f.rasterHeight, 1, OCR_LIMITS.rasterSide, true);
  if (width * height > OCR_LIMITS.rasterPixels) limited();
  const baseWidth = number(f.baseWidth, .001, 1_000_000), baseHeight = number(f.baseHeight, .001, 1_000_000);
  const matrix = array(f.pixelToBase, 6).map(value => number(value, -1_000_000, 1_000_000));
  if (matrix.length !== 6) invalid();
  const [a, b, c, d, e, g] = matrix as [number, number, number, number, number, number];
  if (Math.abs(a * d - b * c) < Number.EPSILON) invalid();
  for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]] as const) {
    const bx = a * x + c * y + e, by = b * x + d * y + g;
    if (bx < -.001 || by < -.001 || bx > baseWidth + .001 || by > baseHeight + .001) invalid();
  }
  return { width, height };
}
function box(value: unknown, size: { width: number; height: number } | undefined) {
  if (!size) return invalid();
  const b = record(value, ['x', 'y', 'width', 'height']);
  const x = number(b.x, 0, size.width), y = number(b.y, 0, size.height);
  const width = number(b.width, 0, size.width), height = number(b.height, 0, size.height);
  if (x + width > size.width + .001 || y + height > size.height + .001) invalid();
}

export function validateOcrDocument(value: unknown): OcrDocumentResult {
  const document = record(value, ['schemaVersion', 'documentId', 'sourceType', 'pageCount', 'pages', 'language', 'engine', 'warnings', 'status']);
  enumeration(document.schemaVersion, [1]); text(document.documentId, 128, 1);
  if (!/^[A-Za-z0-9_-]+$/.test(document.documentId as string)) invalid();
  enumeration(document.sourceType, ['pdf', 'image']); enumeration(document.language, languages);
  enumeration(document.status, ['ready', 'queued', 'processing', 'completed', 'partial', 'failed', 'cancelled']);
  const pageCount = number(document.pageCount, 1, OCR_LIMITS.physicalPages, true);
  if (document.sourceType === 'image' && pageCount !== 1) invalid();
  const pages = array(document.pages, OCR_LIMITS.physicalPages);
  if (pages.length !== pageCount) invalid();
  const engine = record(document.engine, ['id', 'version', 'coreVersion']);
  text(engine.id, 96, 1); text(engine.version, 64, 1); if (engine.coreVersion !== undefined) text(engine.coreVersion, 64, 1);
  warnings(document.warnings, pageCount);
  const seen = new Set<number>();
  let textUnits = 0, lineCount = 0, extraTextUnits = 0, objectBytes = 512, ocrPages = 0;
  for (const value of pages) {
    const page = record(value, ['pageNumber', 'status', 'attempt', 'committed']);
    const pageNumber = number(page.pageNumber, 1, pageCount, true);
    if (seen.has(pageNumber)) invalid(); seen.add(pageNumber);
    enumeration(page.status, ['pending', 'preparing', 'recognizing', 'completed', 'empty', 'failed', 'cancelled']);
    const attempt = record(page.attempt, ['revision', 'language', 'quality', 'preprocessing', 'rotation', 'warnings', 'error']);
    const revision = number(attempt.revision, 0, Number.MAX_SAFE_INTEGER, true);
    settings(attempt); warnings(attempt.warnings, pageCount); objectBytes += 512;
    if (attempt.error !== undefined) enumeration(attempt.error, errorCodes);
    if (page.committed === undefined) {
      if (page.status === 'completed' || page.status === 'empty' || document.status === 'completed') invalid();
      continue;
    }
    const content = record(page.committed, ['revision', 'origin', 'text', 'blocks', 'confidence', 'language', 'quality',
      'preprocessing', 'rotation', 'warnings', 'durationMs', 'frame']);
    number(content.revision, 1, revision, true); enumeration(content.origin, ['ocr', 'text-layer']);
    textUnits += text(content.text, OCR_LIMITS.pageTextUnits).length;
    enumeration(content.rotation, rotations); warnings(content.warnings, pageCount);
    if (content.origin === 'ocr') { settings(content); confidence(content.confidence); ocrPages++; }
    else if (['language', 'quality', 'preprocessing', 'confidence'].some(key => content[key] !== undefined)) invalid();
    if (content.durationMs !== undefined) number(content.durationMs, 0, OCR_LIMITS.runMs);
    const size = content.frame === undefined ? undefined : frame(content.frame);
    let pageLines = 0;
    if (content.blocks !== undefined) for (const value of array(content.blocks, OCR_LIMITS.pageLines)) {
      const block = record(value, ['lines', 'box']); objectBytes += 96;
      if (block.box !== undefined) box(block.box, size);
      for (const value of array(block.lines, OCR_LIMITS.pageLines)) {
        const line = record(value, ['text', 'box', 'confidence']);
        extraTextUnits += text(line.text, OCR_LIMITS.pageTextUnits).length;
        confidence(line.confidence); if (line.box !== undefined) box(line.box, size);
        pageLines++; objectBytes += 192;
        if (pageLines > OCR_LIMITS.pageLines) limited();
      }
    }
    lineCount += pageLines;
    if (textUnits > OCR_LIMITS.documentTextUnits || extraTextUnits > OCR_LIMITS.documentTextUnits
      || lineCount > OCR_LIMITS.documentLines || ocrPages > OCR_LIMITS.ocrPages
      || objectBytes + 2 * (textUnits + extraTextUnits) > OCR_LIMITS.documentResultBytes) limited();
  }
  if (JSON.stringify(value).length * 2 + objectBytes > OCR_LIMITS.documentResultBytes) limited();
  return value as OcrDocumentResult;
}
