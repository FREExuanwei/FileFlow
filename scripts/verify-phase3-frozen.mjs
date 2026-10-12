import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function permittedMap(original = {}, current = {}, additions = {}, changes = {}) {
  return Object.entries(original).every(([key, value]) => canonical(current[key]) === canonical(value)
      || (Object.hasOwn(changes, key) && current[key] === changes[key]))
    && Object.entries(current).every(([key, value]) => Object.hasOwn(original, key)
      || (Object.hasOwn(additions, key) && value === additions[key]));
}
function permittedPackage(original, current, policy) {
  if (!permittedMap(original.dependencies, current.dependencies, policy.allowedRuntime)) return false;
  if (!permittedMap(original.devDependencies, current.devDependencies, policy.allowedDev)) return false;
  if (!permittedMap(original.scripts, current.scripts, policy.allowedScripts, policy.allowedScripts)) return false;
  const coreOverride = { 'tesseract.js-core': '7.0.0' };
  const expectedOverrides = { ...original.overrides, ...(current.overrides?.['tesseract.js'] ? { 'tesseract.js': coreOverride } : {}) };
  if (canonical(current.overrides ?? {}) !== canonical(expectedOverrides)) return false;
  const omitAllowed = object => Object.fromEntries(Object.entries(object).filter(([key]) => !['dependencies', 'devDependencies', 'scripts', 'overrides'].includes(key)));
  return canonical(omitAllowed(original)) === canonical(omitAllowed(current));
}

export function verifyFrozen(root, policy) {
  const report = { unchanged: [], allowedIntegration: [], unexpected: [] };
  const protectedPaths = new Set(policy.protectedPaths ?? []);
  for (const record of policy.files) {
    const path = record.path.replaceAll('\\', '/');
    const target = resolve(root, path);
    if (relative(root, target).startsWith('..') || isAbsolute(relative(root, target))) { report.unexpected.push(path); continue; }
    let hash;
    try { hash = createHash('sha256').update(readFileSync(target)).digest('hex'); } catch { report.unexpected.push(path); continue; }
    if (hash.toLowerCase() === record.sha256.toLowerCase()) report.unchanged.push(path);
    else if (policy.integrationPaths.includes(path) && !protectedPaths.has(path)) report.allowedIntegration.push(path);
    else report.unexpected.push(path);
  }
  try {
    const current = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
    if (canonical(current) === canonical(policy.originalPackage)) report.unchanged.push('package.json');
    else if (permittedPackage(policy.originalPackage, current, policy)) report.allowedIntegration.push('package.json');
    else report.unexpected.push('package.json');
  } catch { report.unexpected.push('package.json'); }
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = name => JSON.parse(readFileSync(join(root, 'docs/phase4/baseline', name), 'utf8').replace(/^\uFEFF/, ''));
  const protectedFiles = read('protected-algorithms.json');
  const files = new Map(read('source-hashes.json').map(record => {
    const path = isAbsolute(record.path) ? relative(root, record.path).replaceAll('\\', '/') : record.path;
    return [path, { ...record, path }];
  }));
  for (const record of protectedFiles) files.set(record.path, record);
  for (const record of read('test-hashes.json')) files.set(record.path, record);
  const report = verifyFrozen(root, {
    files: [...files.values()], protectedPaths: protectedFiles.map(record => record.path),
    integrationPaths: ['src/core/resources/budget.ts', 'src/core/ai-ready/queue.ts', 'src/app/App.tsx',
      'src/components/WorkspaceModes.tsx', 'src/components/ai-ready/Workspace.tsx', 'src/components/ai-ready/Queue.tsx',
      'src/components/ai-ready/Results.tsx', 'src/i18n/en.ts', 'src/i18n/zh-CN.ts',
      'scripts/prepare-assets.mjs', 'scripts/collect-notices.mjs'],
    originalPackage: read('package.json'), allowedRuntime: { 'tesseract.js': '7.0.0' },
    allowedDev: { '@tesseract.js-data/eng': '1.0.0', '@tesseract.js-data/chi_sim': '1.0.0' },
    allowedScripts: { test: 'vitest run && npm run test:browser && npm run test:ocr',
      'test:ocr': 'node node_modules/@playwright/test/cli.js test --config=playwright.ocr.config.ts' },
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.unexpected.length ? 1 : 0;
}
