import type { OcrAssetsManifest, OcrAssetRecord } from '../src/core/ocr/types.ts';
export function validateAssetManifest(value: unknown): OcrAssetsManifest;
export function verifyAssetBytes(record: OcrAssetRecord, bytes: Uint8Array): void;
export function copyVerifiedAsset(options: { sourceRoot: string; sourcePath: string; outputRoot: string; record: OcrAssetRecord }): void;
