export type OcrLanguage = 'eng' | 'chi_sim' | 'chi_sim+eng';
export type QuarterTurn = 0 | 90 | 180 | 270;
export type Quality = 'fast' | 'standard' | 'high';
export type Preprocessing = 'original' | 'enhanced';
export type PageStatus = 'pending' | 'preparing' | 'recognizing' | 'completed' | 'empty' | 'failed' | 'cancelled';
export type DocumentStatus = 'ready' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type OcrErrorCode = 'unsupported-format' | 'invalid-file' | 'encrypted-pdf' | 'no-pages' | 'render-failed'
  | 'ocr-engine-load-failed' | 'ocr-language-load-failed' | 'page-recognition-failed' | 'resource-limit'
  | 'cancelled' | 'timeout' | 'offline-assets-unavailable';
export class OcrError extends Error {
  constructor(readonly code: OcrErrorCode, options?: ErrorOptions) { super(code, options); this.name = 'OcrError'; }
}
export interface OcrWarning {
  code: 'low-confidence' | 'empty-recognition' | 'uncertain-text-layer' | 'missing-page' | 'resolution-capped' | 'layout-limitation';
  pageNumber?: number;
}
export interface Box { x: number; y: number; width: number; height: number }
export interface OcrLine { text: string; box?: Box; confidence?: number }
export interface OcrBlock { lines: OcrLine[]; box?: Box }
export interface OcrPageContent {
  revision: number; origin: 'ocr' | 'text-layer'; text: string; blocks?: OcrBlock[];
  confidence?: number; language?: OcrLanguage; quality?: Quality; preprocessing?: Preprocessing;
  rotation: QuarterTurn; warnings: OcrWarning[]; durationMs?: number;
  frame?: { rasterWidth: number; rasterHeight: number; baseWidth: number; baseHeight: number;
    pixelToBase: readonly [number, number, number, number, number, number] };
}
export type OcrPageFrame = NonNullable<OcrPageContent['frame']>;
export interface OcrSettings { language: OcrLanguage; quality: Quality; preprocessing: Preprocessing; rotation: QuarterTurn }
export interface OcrPageResult {
  pageNumber: number; status: PageStatus;
  attempt: OcrSettings & { revision: number; warnings: OcrWarning[]; error?: OcrErrorCode };
  committed?: OcrPageContent;
}
export interface OcrDocumentResult {
  schemaVersion: 1; documentId: string; sourceType: 'pdf' | 'image'; pageCount: number;
  pages: OcrPageResult[]; language: OcrLanguage;
  engine: { id: string; version: string; coreVersion?: string };
  warnings: OcrWarning[]; status: DocumentStatus;
}
export interface OcrCapabilities {
  languages: OcrLanguage[]; confidence: boolean; boundingBoxes: boolean; orientationDetection: boolean;
  layoutDetection: boolean; tables: boolean; formula: boolean; handwriting: boolean;
}
export interface OcrProgress {
  stage: 'loading-engine' | 'loading-language' | 'preparing-page' | 'recognizing-page' | 'assembling';
  pageNumber?: number; pageCount?: number; fraction?: number;
}
export interface PagePixels { width: number; height: number; format: 'png'; encoded: Uint8Array }
export interface OcrEngine {
  initialize(language: OcrLanguage, signal: AbortSignal, progress: (value: OcrProgress) => void): Promise<void>;
  recognizePage(input: PagePixels, signal: AbortSignal, progress: (value: OcrProgress) => void): Promise<{
    text: string; confidence?: number; blocks?: OcrBlock[];
  }>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
  getCapabilities(): OcrCapabilities;
}
export interface OcrRunContext { documentId: string; generation: number; signal: AbortSignal; onProgress: (value: OcrProgress) => void }
export interface OcrSourceRef { sourceId: string; name: string; type: string; size: number }
export interface OcrPageMetrics {
  pageNumber: number; width: number; height: number; centralCharacters: number; lineCount: number;
  badCharacterRatio: number; textCoverage: number; imageCoverage?: number; hasVisibleRaster: boolean;
  metricsReliable: boolean; blankSample: boolean;
}
export interface OcrMemoryProfile {
  engineBytes: number; decodeBytes: number; scratchBytes: number; previewBytes: number;
  transportBytes: number; maxRasterPixels: number;
}
export interface OcrAssetRecord {
  id: string; path: string; sourceUrl: string; sourceVersion: string; packageName?: string;
  relationship: 'direct' | 'transitive' | 'model' | 'generated'; bytes: number; sha256: string;
  licenseReferences: string[]; noticeReferences: string[]; decodedBytes?: number; decodedLimit?: number;
}
export interface OcrAssetsManifest {
  schemaVersion: 1; engineVersion: string; coreVersion: string; dataCommit: string; files: OcrAssetRecord[];
}
export interface OcrAssetPaths { workerPath: string; corePath: string; langPath: string; allowedPaths: readonly string[] }
