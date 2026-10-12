import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyFrozen, type FrozenPolicy } from '../../scripts/verify-phase3-frozen.mjs';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fileflow-fictional-freeze-'));
  directories.push(root);
  mkdirSync(join(root, 'src/core/ai-ready'), { recursive: true });
  writeFileSync(join(root, 'src/core/ai-ready/tokens.ts'), 'fictional original algorithm');
  const originalPackage = { name: 'fictional-fileflow', dependencies: { react: '19.3.0' }, devDependencies: {}, scripts: { test: 'vitest run' } };
  writeFileSync(join(root, 'package.json'), JSON.stringify(originalPackage));
  const policy: FrozenPolicy = {
    files: [{ path: 'src/core/ai-ready/tokens.ts', sha256: createHash('sha256').update('fictional original algorithm').digest('hex') }],
    integrationPaths: [], originalPackage,
    allowedRuntime: { 'tesseract.js': '7.0.0' },
    allowedDev: { '@tesseract.js-data/eng': '1.0.0', '@tesseract.js-data/chi_sim': '1.0.0' },
    allowedScripts: {},
  };
  return { root, policy, originalPackage };
}

it('detects_frozen_algorithm_change_without_rebaselining', () => {
  const { root, policy } = fixture();
  writeFileSync(join(root, 'src/core/ai-ready/tokens.ts'), 'fictional changed algorithm');
  expect(verifyFrozen(root, policy).unexpected).toContain('src/core/ai-ready/tokens.ts');
  expect(policy.files[0]!.sha256).toBe(createHash('sha256').update('fictional original algorithm').digest('hex'));
});

it('distinguishes_approved_dependency_addition_from_algorithm_change', () => {
  const { root, policy, originalPackage } = fixture();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...originalPackage, dependencies: { ...originalPackage.dependencies, 'tesseract.js': '7.0.0' } }));
  const report = verifyFrozen(root, policy);
  expect(report.unexpected).toEqual([]);
  expect(report.allowedIntegration).toContain('package.json');
  expect(report.unchanged).toContain('src/core/ai-ready/tokens.ts');
});

it('rejects_unapproved_upgrade_of_an_existing_dependency', () => {
  const { root, policy, originalPackage } = fixture();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...originalPackage, dependencies: { react: '99.0.0' } }));
  expect(verifyFrozen(root, policy).unexpected).toContain('package.json');
});

it('rejects_removal_of_a_frozen_dependency', () => {
  const { root, policy, originalPackage } = fixture();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...originalPackage, dependencies: {} }));
  expect(verifyFrozen(root, policy).unexpected).toContain('package.json');
});

it('protected_algorithm_cannot_be_made_mutable_by_integration_allowlist', () => {
  const { root, policy } = fixture();
  policy.integrationPaths = ['src/core/ai-ready/tokens.ts'];
  policy.protectedPaths = ['src/core/ai-ready/tokens.ts'];
  writeFileSync(join(root, 'src/core/ai-ready/tokens.ts'), 'fictional override');
  expect(verifyFrozen(root, policy).unexpected).toContain('src/core/ai-ready/tokens.ts');
});
