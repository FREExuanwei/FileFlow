import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const packages = ['react','react-dom','pdfjs-dist','mammoth','turndown','markdown-it','dompurify','papaparse','yaml','xlsx'];
const target = 'docs/third-party';
mkdirSync(target, { recursive: true });
for (const name of packages) {
  const source = join('node_modules', name), output = join(target, name);
  mkdirSync(output, { recursive: true });
  const metadata = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  writeFileSync(join(output, 'package.json'), JSON.stringify({ name, version: metadata.version, license: metadata.license, repository: metadata.repository }, null, 2) + '\n');
  for (const file of readdirSync(source)) if (/^(license|licence|copying|notice)(\.|$)/i.test(file) && existsSync(join(source, file))) cpSync(join(source, file), join(output, file));
}
console.log('Collected major runtime package license texts and upstream metadata.');
const admitted='docs/phase5/dependencies/NOTICE';
if(existsSync(admitted))writeFileSync('public/THIRD_PARTY_NOTICES.txt',readFileSync(admitted));
