import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyPhase5Frozen as verify } from '../../scripts/verify-phase5-frozen.mjs';
import { validateBrowserBaseline, validateCaseIdentities, validateSealedBaseline, type BrowserCaseResult } from '../../scripts/phase5-regression.mjs';
import { converters } from '../../src/core/registry';

const directories: string[] = [];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const trusts = new Map<string, {anchorSha256:string;packageSha256:string}>();
const canonical = (v: unknown) => JSON.stringify(v, (_key, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b, 'en'))) : x);
const verifyPhase5Frozen = (root: string) => verify(root, trusts.get(root));
afterEach(() => {
  for (const path of directories.splice(0)) {
    if (!resolve(path).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary cleanup target');
    rmSync(path, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fileflow-fictional-phase5-'));
  directories.push(root);
  const files = [
    { path: 'src/core/ai-ready/tokens.ts', text: 'original fictional algorithm', protected: true },
    { path: 'tests/unit/original.test.ts', text: 'original fictional assertion', protected: true },
    { path: 'src/app/App.tsx', text: 'original fictional app', protected: false },
  ];
  for (const file of files) { mkdirSync(join(root, file.path, '..'), { recursive: true }); writeFileSync(join(root, file.path), file.text); }
  const originalPackage = { name: 'fictional-fileflow', dependencies: { react: '19.3.0' }, devDependencies: {}, scripts: { test: 'vitest run' }, overrides: {} };
  mkdirSync(join(root, 'docs/phase5'), { recursive: true });
  const baseline = { schemaVersion: 1, files: files.map(f => ({ path: f.path, sha256: hash(f.text), protected: f.protected })), originalPackage };
  writeFileSync(join(root, 'package.json'), JSON.stringify(originalPackage));
  writeFileSync(join(root, 'docs/phase5/baseline.json'), JSON.stringify(baseline));
  const anchor = JSON.stringify({ files: baseline.files.map(({path,sha256}) => ({path,sha256})) });
  writeFileSync(join(root, 'docs/phase5/plan-protected-before.json'), anchor);
  trusts.set(root, {anchorSha256:hash(anchor),packageSha256:hash(canonical(originalPackage))});
  writeFileSync(join(root, 'docs/phase5/integration-policy.json'), JSON.stringify({ allowedPaths: ['src/app/App.tsx'], reviewedHashes: {}, allowedRuntime: { yaml: '2.9.1', xlsx: 'file:vendor/xlsx-0.20.3.tgz' } }));
  return { root, originalPackage };
}

it('reports unchanged frozen files without rebaselining', () => {
  const { root } = fixture();
  expect(verifyPhase5Frozen(root).unexpected).toEqual([]);
  expect(verifyPhase5Frozen(root).unchanged).toContain('src/core/ai-ready/tokens.ts');
});
it('rejects_rebaseline_of_changed_algorithm_or_changed_anchor', () => {
  const { root } = fixture(), path = 'src/core/ai-ready/tokens.ts';
  writeFileSync(join(root, path), 'changed fictional algorithm');
  const p = join(root, 'docs/phase5/baseline.json'), b = JSON.parse(readFileSync(p, 'utf8'));
  b.files.find((f: {path:string}) => f.path === path).sha256 = hash('changed fictional algorithm');
  writeFileSync(p, JSON.stringify(b));
  expect(verifyPhase5Frozen(root).unexpected).toContain(path);
  writeFileSync(join(root, 'docs/phase5/plan-protected-before.json'), JSON.stringify({files:b.files}));
  expect(verifyPhase5Frozen(root).unexpected).toContain('docs/phase5/plan-protected-before.json');
});
it('does_not_admit_an_unverified_or_contradictory_PASS_label', () => {
  const {root,originalPackage} = fixture();
  writeFileSync(join(root, 'package.json'), JSON.stringify({...originalPackage, dependencies:{...originalPackage.dependencies,yaml:'2.9.1'}}));
  mkdirSync(join(root, 'docs/phase5/dependencies'));
  writeFileSync(join(root, 'docs/phase5/dependencies/manifest.json'), JSON.stringify({packages:[{name:'yaml',decision:'PASS',dependencySpec:'2.9.1',version:'0.0.0',source:'https://invalid.example',advisories:[{disposition:'Unresolved',severity:'HIGH'}]}]}));
  expect(verifyPhase5Frozen(root).unexpected).toContain('package.json');
});
it('rejects_replaced_missing_or_duplicate_original_case_identity', () => {
  const expected = [{file:'a.test.ts',title:'one'},{file:'b.test.ts',title:'two'}];
  expect(validateCaseIdentities(expected,expected)).toEqual([]);
  expect(validateCaseIdentities([expected[0]!],expected).length).toBeGreaterThan(0);
  expect(validateCaseIdentities([expected[0]!,expected[0]!],expected).length).toBeGreaterThan(0);
  expect(validateCaseIdentities([expected[0]!,{file:'b.test.ts',title:'replacement'}],expected).length).toBeGreaterThan(0);
});
it('rejects_unsealed_or_rewritten_original_identity_baseline', () => {
  const b = JSON.parse(readFileSync('docs/phase5/baseline.json','utf8'));
  expect(validateSealedBaseline(b)).toEqual([]);
  expect(validateSealedBaseline({...b,verifiedRun:undefined}).length).toBeGreaterThan(0);
  b.originalBrowserCases[89].title = 'fictional replacement';
  expect(validateSealedBaseline(b).length).toBeGreaterThan(0);
});
it.each(['src/core/ai-ready/tokens.ts', 'tests/unit/original.test.ts'])('detects_algorithm_or_original_test_edit_without_rebaseline: %s', path => {
  const { root } = fixture(), original = readFileSync(join(root, 'docs/phase5/baseline.json'), 'utf8');
  writeFileSync(join(root, path), 'changed fictional bytes');
  expect(verifyPhase5Frozen(root).unexpected).toContain(path);
  expect(readFileSync(join(root, 'docs/phase5/baseline.json'), 'utf8')).toBe(original);
});
it('rejects_unapproved_dependency_upgrade even with a reviewed package hash', () => {
  const { root, originalPackage } = fixture();
  const pkg = JSON.stringify({ ...originalPackage, dependencies: { react: '99.0.0' } });
  writeFileSync(join(root, 'package.json'), pkg);
  writeFileSync(join(root, 'docs/phase5/integration-policy.json'), JSON.stringify({ allowedPaths: ['package.json'], reviewedHashes: { 'package.json': hash(pkg) }, allowedRuntime: {} }));
  expect(verifyPhase5Frozen(root).unexpected).toContain('package.json');
});
it('accepts only specifically reviewed integration bytes', () => {
  const { root } = fixture();
  writeFileSync(join(root, 'src/app/App.tsx'), 'reviewed fictional integration');
  expect(verifyPhase5Frozen(root).unexpected).toContain('src/app/App.tsx');
  writeFileSync(join(root, 'docs/phase5/integration-policy.json'), JSON.stringify({ allowedPaths: ['src/app/App.tsx'], reviewedHashes: { 'src/app/App.tsx': hash('reviewed fictional integration') }, allowedRuntime: {} }));
  expect(verifyPhase5Frozen(root).integration).toEqual(['src/app/App.tsx']);
  expect(verifyPhase5Frozen(root).unexpected).toEqual([]);
});
it('cannot authorize a frozen algorithm via an integration allowlist', () => {
  const { root } = fixture(), path = 'src/core/ai-ready/tokens.ts';
  writeFileSync(join(root, path), 'changed fictional algorithm');
  writeFileSync(join(root, 'docs/phase5/integration-policy.json'), JSON.stringify({ allowedPaths: [path], reviewedHashes: { [path]: hash('changed fictional algorithm') }, allowedRuntime: {} }));
  expect(verifyPhase5Frozen(root).unexpected).toContain(path);
});

const expected = Array.from({ length: 47 }, (_, i) => ({ file: 'fictional.spec.ts', title: `fictional case ${i}` }));
function complete(): BrowserCaseResult[] { return expected.map((c, index) => ({ ...c, index, runId: 'single-run', status: 'passed', retry: 0, attempts: 1 })); }
it('requires_47_distinct_contiguous_original_cases_without_retry', () => {
  expect(validateBrowserBaseline(complete(), expected)).toEqual({ passed: 47, total: 47, contiguous: true, errors: [] });
});
it.each(['missing', 'duplicate', 'separate-run', 'retry', 'skip', 'renamed', 'gap'])('rejects composite or weakened browser baseline: %s', change => {
  const cases = complete();
  if (change === 'missing') cases.pop();
  if (change === 'duplicate') cases[46] = { ...cases[0]!, index: 46 };
  if (change === 'separate-run') cases[46]!.runId = 'second-run';
  if (change === 'retry') { cases[46]!.retry = 1; cases[46]!.attempts = 2; }
  if (change === 'skip') cases[46]!.status = 'skipped';
  if (change === 'renamed') cases[46]!.title = 'renamed replacement';
  if (change === 'gap') cases[46]!.index = 48;
  expect(validateBrowserBaseline(cases, expected).errors.length).toBeGreaterThan(0);
});
it('retains_14_legacy_routes with their original identities', () => {
  expect(converters.map(c => c.id).sort()).toEqual([
    'pdf-to-md', 'pdf-to-txt', 'docx-to-md', 'docx-to-txt', 'md-to-html', 'html-to-md',
    'csv-to-json', 'json-to-csv', 'png-to-jpeg', 'png-to-webp', 'jpeg-to-png', 'jpeg-to-webp', 'webp-to-png', 'webp-to-jpeg',
  ].sort());
});
