import type { OcrMemoryProfile } from './types';
export const MIB = 1024 ** 2;
export const OCR_LIMITS = Object.freeze({
  transientBytes: 256 * MIB, physicalPages: 100, ocrPages: 50,
  pageTextUnits: 65_536, documentTextUnits: 2_097_152, documentResultBytes: 16 * MIB,
  pageLines: 2_000, documentLines: 40_000, rasterPixels: 6_000_000, rasterSide: 4096,
  initializeMs: 120_000, renderMs: 30_000, recognizeMs: 120_000, runMs: 20 * 60_000,
});
// Admission candidates, to be validated by real Chrome/Edge benchmarks in Task 5.
export const INITIAL_OCR_PROFILE: Readonly<OcrMemoryProfile> = Object.freeze({
  engineBytes: 128 * MIB, decodeBytes: 48 * MIB, scratchBytes: 56 * MIB,
  previewBytes: 8 * MIB, transportBytes: 16 * MIB, maxRasterPixels: 6_000_000,
});
