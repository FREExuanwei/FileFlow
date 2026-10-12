import {readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
const i18n='src/i18n/phase3.ts';await writeFile(i18n,(await readFile(i18n,'utf8')).replace('PDF tools · not yet available','PDF tools').replace('PDF 工具 · 暂未提供','PDF 工具'));
for(const file of ['src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock'])await writeFile(file,(await readFile(file,'utf8')).replaceAll('0.2.0-beta.1','0.2.0-beta.2'));
const manifest=JSON.parse(await readFile('docs/pdf-tools/dependencies/manifest.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const candidate of manifest.packages){const installed=lock.packages[`node_modules/${candidate.name}`];if(!installed||installed.version!==candidate.version||installed.integrity!==candidate.dist.integrity)throw Error(`Lockfile mismatch: ${candidate.name}`);}
manifest.installed=true;manifest.lockVerifiedAt=new Date().toISOString();await writeFile('docs/pdf-tools/dependencies/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await copyFile('docs/pdf-tools/dependencies/NOTICE.txt','src-tauri/licenses/PDF-TOOLS-NOTICE.txt');
for(const file of await readdir('docs/pdf-tools/dependencies/licenses'))await copyFile(`docs/pdf-tools/dependencies/licenses/${file}`,`src-tauri/licenses/PDF-TOOLS-${file}`);
