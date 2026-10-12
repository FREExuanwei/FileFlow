import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {evaluateDependency} from './phase5-dependency-policy.mjs';
import {inspectArchive,sha256,verifyFixReports} from './review-phase5-package.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);
const approvedIntegrationPaths = new Set(['src/app/App.tsx','src/components/Workspace.tsx','src/components/QueueSettings.tsx','src/components/QueueResult.tsx','src/components/Dropzone.tsx','src/components/WorkspaceModes.tsx','src/core/queue/store.ts','src/i18n/en.ts','src/i18n/zh-CN.ts','src/styles/app.css','scripts/collect-notices.mjs','package-lock.json','README.md','docs/roadmap.md']);
const originalTrust = {anchorSha256:'ffd0af21ba284950cfa76414b2a2eb176eafdbc5172116b005712535fca863da',packageSha256:'de0771cceda73bcff915761cd035ee62e4d4f857504dbd36a712151874eb89d0'};
const hash = value => createHash('sha256').update(value).digest('hex');
function permittedPackage(root, original, current, policy) {
  const { dependencies: oldDependencies = {}, ...oldRest } = original;
  const { dependencies: currentDependencies = {}, ...currentRest } = current;
  if (canonical(oldRest) !== canonical(currentRest)) return false;
  if (Object.entries(oldDependencies).some(([name, version]) => currentDependencies[name] !== version)) return false;
  const additions = Object.entries(currentDependencies).filter(([name]) => !Object.hasOwn(oldDependencies, name));
  if (!additions.length) return canonical(oldDependencies) === canonical(currentDependencies);
  try{
    const manifest=read(join(root,'docs/phase5/dependencies/manifest.json')),advisories=read(join(root,'docs/phase5/dependencies/advisories.json'));
    return additions.every(([name,version])=>{
      if(policy.allowedRuntime?.[name]!==version)return false;
      const record=manifest.packages?.find(item=>item.name===name);if(!record||record.decision!=='PASS'||record.dependencySpec!==version||evaluateDependency(record,advisories.filter(item=>item.package===name)).decision!=='PASS')return false;
      if(!verifyFixReports(root,record))return false;
      const bytes=readFileSync(join(root,`vendor/${name}-${record.version}.tgz`));if(sha256(bytes)!==record.archiveSha256||bytes.length!==record.bytes)return false;
      if(name==='yaml'&&`sha512-${createHash('sha512').update(bytes).digest('base64')}`!==record.integrity)return false;
      const members=inspectArchive(bytes),hashes=Object.fromEntries([...members].map(([path,value])=>[path,sha256(value)]));
      return canonical(hashes)===canonical(record.memberHashes);
    });
  }catch{return false;}
}

export function verifyPhase5Frozen(root, trust = originalTrust) {
  root = resolve(root);
  const baseline = read(join(root, 'docs/phase5/baseline.json'));
  const policy = read(join(root, 'docs/phase5/integration-policy.json'));
  const report = { unchanged: [], integration: [], unexpected: [] };
  const anchorPath = join(root, 'docs/phase5/plan-protected-before.json');
  let anchor;
  try {
    const bytes = readFileSync(anchorPath);
    if (hash(bytes) !== trust.anchorSha256) throw new Error('Anchor changed');
    anchor = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch { report.unexpected.push('docs/phase5/plan-protected-before.json'); return report; }
  if (canonical(baseline.files.map(({path,sha256}) => ({path,sha256}))) !== canonical(anchor.files)) report.unexpected.push('docs/phase5/baseline.json');
  if (hash(canonical(baseline.originalPackage)) !== trust.packageSha256) report.unexpected.push('docs/phase5/baseline.json:originalPackage');
  for (const file of anchor.files) {
    if (file.path === 'package.json') continue;
    const target = resolve(root, file.path), rel = relative(root, target);
    if (isAbsolute(rel) || rel.startsWith('..')) { report.unexpected.push(file.path); continue; }
    let sha;
    try { sha = createHash('sha256').update(readFileSync(target)).digest('hex'); } catch { report.unexpected.push(file.path); continue; }
    if (sha === file.sha256) report.unchanged.push(file.path);
    else if (approvedIntegrationPaths.has(file.path) && policy.allowedPaths?.includes(file.path) && policy.reviewedHashes?.[file.path] === sha) report.integration.push(file.path);
    else report.unexpected.push(file.path);
  }
  try {
    const current = read(join(root, 'package.json'));
    if (canonical(current) === canonical(baseline.originalPackage)) report.unchanged.push('package.json');
    else if (permittedPackage(root, baseline.originalPackage, current, policy)) report.integration.push('package.json');
    else report.unexpected.push('package.json');
  } catch { report.unexpected.push('package.json'); }
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = verifyPhase5Frozen(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.unexpected.length ? 1 : 0;
}
