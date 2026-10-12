import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectArchive,sha256} from './review-phase5-package.mjs';
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b,'en'))):item);
export function compareInstalledLock(before,after,name){
  const errors=[],{packages:oldPackages,...oldRest}=before,{packages:newPackages,...newRest}=after;
  if(canonical(oldRest)!==canonical(newRest))errors.push('Existing lock metadata changed');
  if(!oldPackages||!newPackages)return [...errors,'Missing lock package inventory'];
  for(const [path,value] of Object.entries(oldPackages)){
    if(path==='')continue;if(canonical(value)!==canonical(newPackages[path]))errors.push(`Original locked package changed: ${path}`);
  }
  for(const path of Object.keys(newPackages))if(!Object.hasOwn(oldPackages,path)&&path!==`node_modules/${name}`)errors.push(`Unreviewed additional package: ${path}`);
  const {dependencies:oldDeps,...oldRoot}=oldPackages[''],{dependencies:newDeps,...newRoot}=newPackages[''];
  if(canonical(oldRoot)!==canonical(newRoot))errors.push('Original root metadata changed');
  const existing={...newDeps};delete existing[name];if(canonical(oldDeps)!==canonical(existing))errors.push('Original root dependencies changed');
  if(name==='yaml'&&newDeps[name]!=='2.9.1')errors.push('YAML declaration must retain exact approved version');
  if(name==='xlsx'&&newDeps[name]!=='file:vendor/xlsx-0.20.3.tgz')errors.push('XLSX declaration must retain fixed local archive');
  return errors;
}
function main(){
  const name=process.argv.includes('--xlsx')?'xlsx':'yaml',version=name==='yaml'?'2.9.1':'0.20.3';
  const root=process.cwd(),read=path=>JSON.parse(readFileSync(join(root,path),'utf8')),before=read(`docs/phase5/dependencies/pre-${name}-lock.json`),after=read('package-lock.json'),pkg=read('package.json');
  const errors=compareInstalledLock(before,after,name);if(pkg.dependencies[name]!== (name==='yaml'?version:`file:vendor/xlsx-${version}.tgz`))errors.push('Root constraint differs from approved declaration');
  const acquisition=read(`docs/phase5/dependencies/${name}-acquisition.json`),bytes=readFileSync(join(root,`vendor/${name}-${version}.tgz`)),members=inspectArchive(bytes);
  if(sha256(bytes)!==acquisition.archiveSha256)errors.push('Acquired archive changed');
  let checked=0;for(const [path,expected] of members){try{const actual=readFileSync(join(root,`node_modules/${name}`,path.slice('package/'.length)));if(sha256(actual)!==sha256(expected))errors.push(`Installed member differs: ${path}`);checked++;}catch{errors.push(`Missing member: ${path}`);}}
  const locked=after.packages[`node_modules/${name}`];if(locked.version!==version||locked.resolved!==`file:vendor/${name}-${version}.tgz`||locked.integrity!==acquisition.integrity)errors.push('Lock is not bound to reviewed local artifact');
  console.log(JSON.stringify({checkedMembers:checked,errors,decision:errors.length?'BLOCKED':'PASS'},null,2));process.exitCode=errors.length?1:0;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main();
