import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export const OCR_ASSET_BASE = '/assets/ocr/tesseract-7.0.0/';
export const OCR_CORE_NAMES = ['tesseract-core', 'tesseract-core-lstm', 'tesseract-core-simd', 'tesseract-core-simd-lstm',
  'tesseract-core-relaxedsimd', 'tesseract-core-relaxedsimd-lstm'];
export const REQUIRED_OCR_PATHS = ['worker.min.js', ...OCR_CORE_NAMES.flatMap(name => [`core-7.0.0/${name}.wasm.js`, `core-7.0.0/${name}.wasm`]),
  'data-1.0.0-best-int/eng.traineddata.gz', 'data-1.0.0-best-int/chi_sim.traineddata.gz'].map(path => OCR_ASSET_BASE + path);
const fail = () => { throw new Error('Invalid OCR asset supply-chain record'); };
function localPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/assets/ocr/') || !/^\/[A-Za-z0-9_./-]+$/.test(path)
    || path.slice(1).split('/').some(segment => !segment || segment === '.' || segment === '..')) fail();
  return path;
}
function assetRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !/^[A-Za-z0-9_.-]{1,120}$/.test(record.id)) fail();
  localPath(record.path);
  if (!REQUIRED_OCR_PATHS.includes(record.path) && !/^\/assets\/ocr\/licenses\/[A-Za-z0-9_.-]+\.txt$/.test(record.path)) fail();
  if (!Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > 50 * 1024 ** 2 || !/^[a-f0-9]{64}$/.test(record.sha256)) fail();
  if (!['direct', 'transitive', 'model', 'generated'].includes(record.relationship)) fail();
  let source; try { source = new URL(record.sourceUrl); } catch { fail(); }
  if (source.protocol !== 'https:' || source.username || source.password || !record.sourceVersion) fail();
  for (const key of ['licenseReferences', 'noticeReferences']) {
    if (!Array.isArray(record[key]) || !record[key].length) fail();
    record[key].forEach(localPath);
  }
  if (record.path.endsWith('.traineddata.gz')) {
    if (!Number.isSafeInteger(record.decodedBytes) || !Number.isSafeInteger(record.decodedLimit)
      || record.decodedBytes <= 0 || record.decodedBytes > record.decodedLimit || record.decodedLimit > 16 * 1024 ** 2) fail();
  }
}
export function validateAssetManifest(value) {
  if (!value || value.schemaVersion !== 1 || value.engineVersion !== '7.0.0' || value.coreVersion !== '7.0.0'
    || value.dataCommit !== '806cd9adc8c6e8abc11c782db1818c990576bebc' || !Array.isArray(value.files)) fail();
  const paths = new Set(), ids = new Set(); let total = 0, decoded = 0;
  for (const record of value.files) {
    assetRecord(record); if (paths.has(record.path) || ids.has(record.id)) fail();
    paths.add(record.path); ids.add(record.id); total += record.bytes; decoded += record.decodedBytes ?? 0;
  }
  if (REQUIRED_OCR_PATHS.some(path => !paths.has(path)) || total > 50 * 1024 ** 2 || decoded > 16 * 1024 ** 2) fail();
  return value;
}
export function verifyAssetBytes(record, bytes) {
  assetRecord(record);
  if (!ArrayBuffer.isView(bytes) || bytes.BYTES_PER_ELEMENT !== 1 || bytes.byteLength !== record.bytes
    || createHash('sha256').update(bytes).digest('hex') !== record.sha256) fail();
}
function safeTarget(root, path) {
  const target = resolve(root, path), delta = relative(resolve(root), target);
  if (!delta || delta.startsWith('..') || isAbsolute(delta)) fail();
  for (let current = target; ; current = dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail();
    if (current === resolve(root)) break;
  }
  return target;
}
export function copyVerifiedAsset({ sourceRoot, sourcePath, outputRoot, record }) {
  assetRecord(record);
  const source = safeTarget(sourceRoot, sourcePath), target = safeTarget(outputRoot, record.path.slice(1));
  if (!lstatSync(source).isFile()) fail();
  const bytes = readFileSync(source); verifyAssetBytes(record, bytes);
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
  verifyAssetBytes(record, readFileSync(target));
}
