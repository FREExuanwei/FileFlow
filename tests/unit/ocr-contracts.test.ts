import { expect, it } from 'vitest';
import { validateOcrDocument } from '../../src/core/ocr/validation';
import type { OcrDocumentResult } from '../../src/core/ocr/types';

function document(): OcrDocumentResult {
  return { schemaVersion: 1, documentId: 'fictional-ocr-1', sourceType: 'pdf', pageCount: 1,
    language: 'chi_sim+eng', engine: { id: 'fictional-engine', version: '1.0.0' }, status: 'completed', warnings: [],
    pages: [{ pageNumber: 1, status: 'completed',
      attempt: { revision: 1, language: 'chi_sim+eng', quality: 'standard', preprocessing: 'original', rotation: 0, warnings: [] },
      committed: { revision: 1, origin: 'ocr', text: '虚构项目 FileFlow', language: 'chi_sim+eng', quality: 'standard',
        preprocessing: 'original', rotation: 0, warnings: [], confidence: 87,
        frame: { rasterWidth: 400, rasterHeight: 400, baseWidth: 200, baseHeight: 200, pixelToBase: [.5, 0, 0, .5, 0, 0] },
        blocks: [{ lines: [{ text: '虚构项目 FileFlow', box: { x: 10, y: 10, width: 200, height: 30 } }] }] } }] };
}
const withPage = (patch: Record<string, unknown>) => ({ ...document(), pages: [{ ...document().pages[0], ...patch }] });
const withContent = (patch: Record<string, unknown>) => withPage({ committed: { ...document().pages[0]!.committed, ...patch } });
const withAttempt = (patch: Record<string, unknown>) => withPage({ attempt: { ...document().pages[0]!.attempt, ...patch } });

it('accepts_bounded_ocr_content_without_rewriting_it', () => {
  const value = document(); expect(validateOcrDocument(value)).toEqual(value);
});
it('contract_errors_expose_structured_codes_for_the_ocr_presentation_adapter', () => {
  let failure: unknown;
  try { validateOcrDocument({ ...document(), language: 'osd' }); } catch (error) { failure = error; }
  expect(failure).toMatchObject({ name: 'OcrError', code: 'invalid-file' });
});
it('failed_retry_preserves_distinct_committed_revision_and_parameters', () => {
  const value = withPage({ status: 'failed', attempt: { ...document().pages[0]!.attempt, revision: 2, rotation: 90, error: 'page-recognition-failed' } });
  const result = validateOcrDocument(value);
  expect(result.pages[0]!.committed!.rotation).toBe(0);
  expect(result.pages[0]!.committed!.revision).toBe(1);
  expect(result.pages[0]!.attempt.revision).toBe(2);
});
it('text_layer_content_has_no_invented_ocr_parameters', () => {
  const value = withPage({ committed: { revision: 1, origin: 'text-layer', text: 'Fictional reliable text.', rotation: 0, warnings: [] } });
  expect(validateOcrDocument(value).pages[0]!.committed).not.toHaveProperty('confidence');
});
it.each([
  ['duplicate_page_number', { ...document(), pageCount: 2, pages: [document().pages[0], document().pages[0]] }],
  ['out_of_range_page', withPage({ pageNumber: 2 })], ['fractional_page', withPage({ pageNumber: 1.5 })],
  ['physical_page_limit', { ...document(), pageCount: 101 }], ['no_pages', { ...document(), pageCount: 0, pages: [] }],
  ['missing_page_record', { ...document(), pageCount: 2 }], ['unsupported_schema', { ...document(), schemaVersion: 2 }],
  ['unknown_language', { ...document(), language: 'osd' }], ['illegal_rotation', withAttempt({ rotation: 45 })],
  ['unsupported_quality', withAttempt({ quality: 'ultra' })], ['unsupported_preprocessing', withAttempt({ preprocessing: 'threshold' })],
  ['unknown_error', withAttempt({ error: 'arbitrary-error' })], ['unknown_warning', withContent({ warnings: [{ code: 'arbitrary-warning' }] })],
  ['warning_page_outside_document', withContent({ warnings: [{ code: 'low-confidence', pageNumber: 2 }] })],
  ['non_finite_confidence', withContent({ confidence: NaN })], ['confidence_above_100', withContent({ confidence: 101 })],
  ['non_finite_box', withContent({ blocks: [{ lines: [{ text: 'fictional', box: { x: NaN, y: 0, width: 20, height: 20 } }] }] })],
  ['box_outside_frame', withContent({ blocks: [{ lines: [{ text: 'fictional', box: { x: 390, y: 0, width: 20, height: 20 } }] }] })],
  ['box_without_frame', withContent({ frame: undefined })],
  ['non_finite_matrix', withContent({ frame: { ...document().pages[0]!.committed!.frame, pixelToBase: [1, 0, 0, Infinity, 0, 0] } })],
  ['singular_matrix', withContent({ frame: { ...document().pages[0]!.committed!.frame, pixelToBase: [0, 0, 0, 0, 0, 0] } })],
  ['oversized_raster', withContent({ frame: { ...document().pages[0]!.committed!.frame, rasterWidth: 5000 } })],
  ['oversized_page_text', withContent({ text: 'x'.repeat(65_537) })],
  ['oversized_lines', withContent({ blocks: [{ lines: Array.from({ length: 2001 }, () => ({ text: 'fictional line' })) }] })],
  ['future_committed_revision', withContent({ revision: 2 })], ['completed_without_content', withPage({ committed: undefined })],
  ['text_layer_fake_confidence', withContent({ origin: 'text-layer' })], ['private_extra_field', { ...document(), absolutePath: 'fictional/path' }],
])('rejects_%s', (_name, value) => { expect(() => validateOcrDocument(value)).toThrow(); });
it('rejects_document_wide_text_and_line_overflow', () => {
  const value = document(); value.pageCount = 50;
  value.pages = Array.from({ length: 50 }, (_, index) => ({ ...structuredClone(value.pages[0]!), pageNumber: index + 1 }));
  for (const page of value.pages) page.committed!.text = 'x'.repeat(50_000);
  expect(() => validateOcrDocument(value)).toThrow('resource-limit');
  for (const page of value.pages) { page.committed!.text = 'fictional'; page.committed!.blocks = [{ lines: Array.from({ length: 1000 }, () => ({ text: 'line' })) }]; }
  expect(() => validateOcrDocument(value)).toThrow('resource-limit');
});
