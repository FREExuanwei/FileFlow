import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { verifyPhase5Frozen } from './verify-phase5-frozen.mjs';
import {acceptanceErrors} from './phase5-acceptance.mjs';

const key = item => `${basename(item.file)}\u0000${item.title}`;
export function validateSealedBaseline(baseline) {
  const fields = ['originalUnitFiles','originalPhase3BrowserCases','originalBrowserFiles','originalUnitCases','preImplementationUnitCases','originalBrowserCases'];
  const identity = JSON.stringify(Object.fromEntries(fields.map(field => [field,baseline[field]])), (_key,item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b,'en'))) : item);
  const errors = [];
  if (!baseline.verifiedRun) errors.push('Baseline is not sealed');
  if (createHash('sha256').update(identity).digest('hex') !== '5087dbce4711be189feb77228a85817681b0d9aa9f92bc466ca23b26167bb878') errors.push('Original identities changed or missing');
  return errors;
}
export function validateCaseIdentities(actual, expected) {
  const wanted = new Set(expected.map(key)), got = new Set(actual.map(key)), errors = [];
  if (got.size !== actual.length || wanted.size !== expected.length) errors.push('Duplicate case identity');
  for (const identity of wanted) if (!got.has(identity)) errors.push(`Missing original case: ${identity}`);
  for (const identity of got) if (!wanted.has(identity)) errors.push(`Unexpected replacement: ${identity}`);
  return errors;
}
export function validateBrowserBaseline(results, expected) {
  const identities = new Set(expected.map(key)), matches = results.filter(item => identities.has(key(item))), errors = [];
  if (expected.length !== 47 || identities.size !== 47 || matches.length !== 47) errors.push('Expected exactly 47 distinct original cases');
  if (new Set(matches.map(key)).size !== 47) errors.push('Duplicate or missing case');
  if (new Set(matches.map(item => item.runId)).size !== 1 || !matches[0]?.runId) errors.push('Cases must share one run');
  const contiguous = matches.length === 47 && matches.every((item, i) => item.index === i);
  if (!contiguous) errors.push('Original cases must be the contiguous first 47 results');
  if (matches.some((item, i) => key(item) !== key(expected[i] ?? { file: '', title: '' }))) errors.push('Original case order changed');
  if (matches.some(item => item.status !== 'passed' || item.retry !== 0 || item.attempts !== 1)) errors.push('Each original case must pass once with no retries or skips');
  return { passed: matches.filter(item => item.status === 'passed' && item.retry === 0 && item.attempts === 1).length, total: expected.length, contiguous, errors };
}

export function browserCases(report, runId) {
  const records = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const result = test.results?.[0];
      records.push({ file: basename(spec.file), title: spec.title, runId, index: 0,
        status: result?.status ?? 'skipped', retry: result?.retry ?? 0, attempts: test.results?.length ?? 0,
        startTime: result?.startTime ?? '9999', project: test.projectName });
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return records.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((record, index) => ({ ...record, index }));
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function npmCli() {
  for (const path of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(path, 'node_modules/npm/bin/npm-cli.js');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Local npm CLI unavailable');
}
async function command(root, directory, name, args, env = {}, optional = false) {
  const log = join(directory, name + '.log'), output = createWriteStream(log);
  console.log(`START ${name}`);
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
    child.on('error', reject);
    child.on('close', code => output.end(() => resolveResult({ name, command: [process.execPath, ...args], exitCode: code, log, optional })));
  });
  console.log(`END ${name} exit=${result.exitCode}`);
  if (result.exitCode !== 0 && !optional) {const error=new Error(`${name} failed; see ${log}`);error.commandResult=result;throw error;}
  return result;
}
function bundleGraph(root) {
  const entries = [];
  const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) walk(path);
    else if (/\.(?:js|css)$/.test(path)) {
      const bytes = readFileSync(path), text = bytes.toString('utf8');
      entries.push({ path: path.slice(root.length + 1).replaceAll('\\', '/'), bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes), imports: [...text.matchAll(/(?:from|import)\s*\(?["']([^"']+)["']/g)].map(m => m[1]) });
    }
  } };
  walk(join(root, 'dist')); return entries;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const mode = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'baseline';
  const channel = process.argv.includes('--channel') ? process.argv[process.argv.indexOf('--channel') + 1] : 'msedge';
  if (!['baseline', 'final'].includes(mode) || channel !== 'msedge') throw new Error('Original regression currently supports msedge; Phase5 Chrome uses its separate config');
  const baselinePath = join(root, 'docs/phase5/baseline.json');
  const baseline = readJson(baselinePath);
  if (mode === 'final' && validateSealedBaseline(baseline).length) throw new Error('Final requires the sealed original baseline and identities');
  if (mode === 'baseline' && baseline.verifiedRun) throw new Error('Baseline already sealed; never overwrite it');
  const runId = `${mode}-${new Date().toISOString().replaceAll(':', '-')}`;
  const directory = join(root, 'docs/phase5/validation', runId); mkdirSync(directory, { recursive: true });
  const summary = { runId, mode, channel, checkedAt: new Date().toISOString(), result: 'IN_PROGRESS', commands: [], node: process.version, originalUnit: null, unit: null, browser: null, frozen: null };
  const save = () => writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  save();
  try {
    summary.frozen = verifyPhase5Frozen(root);
    if (summary.frozen.unexpected.length) throw new Error('Frozen baseline check failed before executing tests');
    summary.commands.push(await command(root, directory, 'npm-version', [npmCli(), '--version']));
    summary.commands.push(await command(root, directory, 'browser-version', ['--input-type=module', '-e', `import {chromium} from '@playwright/test'; for(const channel of ${mode==='final'?"['msedge','chrome']":"['msedge']"}){const browser=await chromium.launch({channel,headless:true}); console.log(JSON.stringify({channel,version:browser.version()})); await browser.close();}`]));
    summary.commands.push(await command(root, directory, 'lint', [npmCli(), 'run', 'lint'])); save();
    summary.commands.push(await command(root, directory, 'typecheck', [npmCli(), 'run', 'typecheck'])); save();
    const originalUnitReport = join(directory, 'original-unit.json');
    summary.commands.push(await command(root, directory, 'original-unit', ['node_modules/vitest/vitest.mjs', 'run', ...baseline.originalUnitFiles, '--pool=threads', '--reporter=json', `--outputFile=${originalUnitReport}`]));
    const original = readJson(originalUnitReport);
    const unitCases = report => report.testResults.flatMap(file => file.assertionResults.map(test => ({file:basename(file.name),title:test.fullName})));
    if (baseline.originalUnitCases && validateCaseIdentities(unitCases(original), baseline.originalUnitCases).length) throw new Error('Original unit identities changed');
    summary.originalUnit = { passed: original.numPassedTests, total: original.numTotalTests, pending: original.numPendingTests, files: baseline.originalUnitFiles.length };
    if (original.numPassedTests !== 103 || original.numTotalTests !== 103 || original.numPendingTests) throw new Error('Original 103-case unit baseline mismatch');
    const unitReport = join(directory, 'unit.json');
    summary.commands.push(await command(root, directory, 'unit', ['node_modules/vitest/vitest.mjs', 'run', '--pool=threads', '--reporter=json', `--outputFile=${unitReport}`]));
    const unit = readJson(unitReport); summary.unit = { passed: unit.numPassedTests, total: unit.numTotalTests, pending: unit.numPendingTests };
    if (baseline.preImplementationUnitCases) {
      const files = new Set(baseline.preImplementationUnitCases.map(item => basename(item.file)));
      if (validateCaseIdentities(unitCases(unit).filter(item => files.has(item.file)), baseline.preImplementationUnitCases).length) throw new Error('Original pre-implementation unit identities changed');
    }
    if (!unit.success || unit.numPendingTests) throw new Error('Full unit suite not completely green'); save();
    summary.commands.push(await command(root, directory, 'build', [npmCli(), 'run', 'build', '--', '--manifest'])); save();
    const browserReport = join(directory, 'original-browser.json');
    summary.commands.push(await command(root, directory, 'original-browser', ['node_modules/@playwright/test/cli.js', 'test', ...baseline.originalBrowserFiles, '--workers=1', '--retries=0', '--reporter=json', `--output=${join(directory, 'browser-artifacts')}`], { PLAYWRIGHT_JSON_OUTPUT_FILE: browserReport }));
    const browser = readJson(browserReport), cases = browserCases(browser, runId);
    if (baseline.originalBrowserCases && validateCaseIdentities(cases,baseline.originalBrowserCases).length) throw new Error('Original browser identities changed');
    summary.browser = { passed: browser.stats.expected, total: cases.length, skipped: browser.stats.skipped, unexpected: browser.stats.unexpected, flaky: browser.stats.flaky, phase3: validateBrowserBaseline(cases, baseline.originalPhase3BrowserCases), cases };
    if (cases.length !== 90 || browser.stats.expected !== 90 || browser.stats.skipped || browser.stats.unexpected || browser.stats.flaky || summary.browser.phase3.errors.length) throw new Error('Original browser baseline mismatch');
    save();
    if(mode==='final'){
      summary.newBrowsers=[];
      for(const engine of ['edge','chrome'])for(const mode of ['development','production']){
        const name=`phase5-${engine}-${mode}`,reportPath=join(directory,name+'.json'),config=mode==='production'?'playwright.phase5-production.config.ts':'playwright.phase5.config.ts';
        summary.commands.push(await command(root,directory,name,['node_modules/@playwright/test/cli.js','test',`--config=${config}`,`--project=${engine}`,'--workers=1','--retries=0','--reporter=line,json',`--output=${join(directory,name+'-artifacts')}`],{PLAYWRIGHT_JSON_OUTPUT_FILE:reportPath}));
        const report=readJson(reportPath),records=browserCases(report,`${runId}-${name}`),stats=report.stats;
        const result={engine,mode,passed:stats.expected,total:records.length,skipped:stats.skipped,unexpected:stats.unexpected,flaky:stats.flaky};summary.newBrowsers.push(result);save();
        if(!records.length||records.some(item=>item.status!=='passed'||item.retry!==0||item.attempts!==1)||result.passed!==result.total||result.skipped||result.unexpected||result.flaky)throw Error(`${name} incomplete`);
      }
    }
    summary.commands.push(await command(root, directory, 'secrets', [npmCli(), 'run', 'secrets']));
    summary.frozen = verifyPhase5Frozen(root);
    if (summary.frozen.unexpected.length) throw new Error('Unexpected frozen source/test/integration change');
    summary.commands.push(await command(root, directory, 'phase4-frozen-policy', ['scripts/verify-phase3-frozen.mjs'], {}, true));
    if(mode==='final'){const legacy=readJson(join(directory,'phase4-frozen-policy.log'));summary.phase4Policy={rawExit:summary.commands.at(-1).exitCode,unexpected:legacy.unexpected,coveredByApprovedPhase5:legacy.unexpected.every(path=>summary.frozen.integration.includes(path))};if(!summary.phase4Policy.coveredByApprovedPhase5)throw Error('Legacy frozen diff is outside approved Phase5 integration');}
    summary.commands.push(await command(root, directory, 'audit', [npmCli(), 'audit', '--json', '--registry=https://registry.npmjs.org'], {}, mode!=='final'));
    if(mode==='final'){
      summary.commands.push(await command(root,directory,'dependency-review',['scripts/verify-phase5-dependencies.mjs']));
      summary.commands.push(await command(root,directory,'bundle',['scripts/measure-phase5-bundle.mjs','--output',join(directory,'bundle-budget.json')]));
      const audit=readJson(join(directory,'audit.log')),advisories=readJson(join(root,'docs/phase5/dependencies/advisories.json'));
      summary.audit={rawVulnerabilities:audit.metadata?.vulnerabilities,rawExit:summary.commands.find(c=>c.name==='audit').exitCode,reviewedAdvisories:advisories.map(a=>({package:a.package,id:a.id,severity:a.severity,disposition:a.disposition}))};
      summary.acceptanceErrors=acceptanceErrors({originalUnit:summary.originalUnit,unit:summary.unit,browser:summary.browser,newBrowsers:summary.newBrowsers,commands:Object.fromEntries(summary.commands.map(c=>[c.name,{exitCode:c.exitCode,executed:true}])),unresolvedHigh:advisories.filter(a=>/HIGH|CRITICAL/i.test(a.severity)&&a.disposition!=='Not applicable with evidence').map(a=>a.id),baselineErrors:validateSealedBaseline(baseline),frozenUnexpected:summary.frozen.unexpected});
      if(summary.acceptanceErrors.length)throw Error(`Acceptance policy failed: ${summary.acceptanceErrors.join(',')}`);
    }
    const bundle = bundleGraph(root); writeFileSync(join(directory, 'bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
    if (mode === 'baseline') {
      if (baseline.verifiedRun) throw new Error('Baseline already sealed; never overwrite it');
      baseline.verifiedRun = { runId, directory: directory.slice(root.length + 1).replaceAll('\\', '/'), originalUnit: summary.originalUnit, unit: summary.unit, browserTotal: 90, phase3: summary.browser.phase3 };
      baseline.bundle = bundle;
      baseline.originalUnitCases = original.testResults.flatMap(file => file.assertionResults.map(test => ({ file: file.name.slice(root.length + 1).replaceAll('\\', '/'), title: test.fullName })));
      baseline.preImplementationUnitCases = unit.testResults.filter(file => !basename(file.name).startsWith('phase5-')).flatMap(file => file.assertionResults.map(test => ({ file: file.name.slice(root.length + 1).replaceAll('\\', '/'), title: test.fullName })));
      baseline.originalBrowserCases = cases.map(({ file, title }) => ({ file, title }));
      writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
    }
    summary.result = 'PASS'; save();
    console.log(JSON.stringify({ result: summary.result, directory, originalUnit: summary.originalUnit, unit: summary.unit, browser: { passed: summary.browser.passed, total: summary.browser.total, phase3: summary.browser.phase3 }, frozenUnexpected: summary.frozen.unexpected }));
  } catch (error) {if(error.commandResult)summary.commands.push(error.commandResult);summary.result = 'FAIL'; summary.error = String(error); save(); throw error; }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.message); process.exitCode = 1; });
