import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAssetManifest, verifyAssetBytes, copyVerifiedAsset } from '../../scripts/ocr-asset-policy.mjs';
import type { OcrAssetRecord, OcrAssetsManifest } from '../../src/core/ocr/types';

const fictional = new TextEncoder().encode('fictional asset bytes');
const hash = createHash('sha256').update(fictional).digest('hex');
const base = '/assets/ocr/tesseract-7.0.0/';
const paths = ['worker.min.js', ...['tesseract-core', 'tesseract-core-lstm', 'tesseract-core-simd', 'tesseract-core-simd-lstm',
  'tesseract-core-relaxedsimd', 'tesseract-core-relaxedsimd-lstm'].flatMap(name => [`core-7.0.0/${name}.wasm.js`, `core-7.0.0/${name}.wasm`]),
  'data-1.0.0-best-int/eng.traineddata.gz', 'data-1.0.0-best-int/chi_sim.traineddata.gz'];
function manifest(): OcrAssetsManifest {
  return { schemaVersion: 1, engineVersion: '7.0.0', coreVersion: '7.0.0', dataCommit: '806cd9adc8c6e8abc11c782db1818c990576bebc',
    files: paths.map((path, index) => ({ id: `fictional-${index}`, path: base + path,
      sourceUrl: 'https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz', sourceVersion: '7.0.0',
      relationship: path.endsWith('.gz') ? 'model' : 'transitive', bytes: fictional.length, sha256: hash,
      licenseReferences: ['/assets/ocr/licenses/fictional-license.txt'], noticeReferences: ['/assets/ocr/licenses/fictional-notice.txt'],
      ...(path.endsWith('.gz') ? { decodedBytes: 100, decodedLimit: 16 * 1024 ** 2 } : {}) })) };
}
it('accepts_complete_fixed_version_local_manifest', () => { const value = manifest(); expect(validateAssetManifest(value)).toEqual(value); });
it.each(['https://cdn.example.invalid/core.wasm.js', '//cdn.example.invalid/core.js', '/assets/ocr/../private.txt',
  '/assets/ocr/file.js?content=fictional', '/assets/ocr/%2e%2e/file.js', '/assets/ocr/file.js#fragment', '/assets/ocr/file\\name.js'])('rejects_external_or_unsafe_asset_path_%s', path => {
  const value = manifest(); value.files[0]!.path = path; expect(() => validateAssetManifest(value)).toThrow();
});
it.each(['licenseReferences', 'noticeReferences'] as const)('rejects_missing_%s', key => {
  const value = manifest(); value.files[0]![key] = []; expect(() => validateAssetManifest(value)).toThrow();
});
it('detects_one_byte_tamper_and_wrong_size', () => {
  const record = manifest().files[0]!, tampered = fictional.slice(); tampered[0] = tampered[0]! ^ 1;
  expect(() => verifyAssetBytes(record, fictional)).not.toThrow();
  expect(() => verifyAssetBytes(record, tampered)).toThrow();
  expect(() => verifyAssetBytes(record, fictional.slice(1))).toThrow();
});
it('rejects_unapproved_language_and_missing_local_asset', () => {
  const value = manifest(); value.files.at(-1)!.path = base + 'data-1.0.0-best-int/osd.traineddata.gz';
  expect(() => validateAssetManifest(value)).toThrow();
  const incomplete = manifest(); incomplete.files.pop(); expect(() => validateAssetManifest(incomplete)).toThrow();
});
it('rejects_unpinned_version_and_duplicate_or_invalid_fingerprint', () => {
  expect(() => validateAssetManifest({ ...manifest(), coreVersion: '7.0.1' })).toThrow();
  const duplicate = manifest(); duplicate.files[1] = duplicate.files[0]!; expect(() => validateAssetManifest(duplicate)).toThrow();
  const badHash = manifest(); badHash.files[0]!.sha256 = 'npm-sha512-is-not-file-sha256'; expect(() => validateAssetManifest(badHash)).toThrow();
});
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function directories() {
  const root = mkdtempSync(join(tmpdir(), 'fileflow-fictional-asset-')); roots.push(root);
  const sourceRoot = join(root, 'source'), outputRoot = join(root, 'public'); mkdirSync(sourceRoot); mkdirSync(outputRoot);
  return { root, sourceRoot, outputRoot };
}
it('copies_only_hash_verified_files_and_rejects_path_escape_without_writing', () => {
  const { sourceRoot, outputRoot } = directories(); writeFileSync(join(sourceRoot, 'fictional.js'), fictional);
  const record = manifest().files[0]!;
  copyVerifiedAsset({ sourceRoot, sourcePath: 'fictional.js', outputRoot, record });
  expect(existsSync(join(outputRoot, record.path.slice(1)))).toBe(true);
  const escaped: OcrAssetRecord = { ...record, path: '/../outside.js' };
  expect(() => copyVerifiedAsset({ sourceRoot, sourcePath: 'fictional.js', outputRoot, record: escaped })).toThrow();
  expect(() => copyVerifiedAsset({ sourceRoot, sourcePath: '../outside.js', outputRoot, record })).toThrow();
});
it('rejects_symlink_source_and_destination', () => {
  const { root, sourceRoot, outputRoot } = directories(), outside = join(root, 'outside'); mkdirSync(outside);
  writeFileSync(join(outside, 'fictional.js'), fictional); symlinkSync(outside, join(sourceRoot, 'link'), 'junction');
  expect(() => copyVerifiedAsset({ sourceRoot, sourcePath: 'link/fictional.js', outputRoot, record: manifest().files[0]! })).toThrow();
  writeFileSync(join(sourceRoot, 'fictional.js'), fictional);
  symlinkSync(outside, join(outputRoot, 'assets'), 'junction');
  expect(() => copyVerifiedAsset({ sourceRoot, sourcePath: 'fictional.js', outputRoot, record: manifest().files[0]! })).toThrow();
});
