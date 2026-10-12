import {readFile,writeFile} from 'node:fs/promises';
async function edit(path,changes){let s=await readFile(path,'utf8');for(const [before,after]of changes){if(!s.includes(before))throw Error(`missing integration anchor ${path}: ${before.slice(0,50)}`);s=s.replace(before,after);}await writeFile(path,s);}
await edit('src/adapters/web/phase5-output.ts',[
 ['save(blob:Blob,filename:string){const url=',"save(blob:Blob,filename:string){const desktop=getDesktopPlatform();if(desktop){this.cancellations.push(desktop.save(blob,filename));return;}const url="],
 ['dispose(){for(',"dispose(){this.cancellations.forEach(cancel=>cancel());this.cancellations=[];for("]]);
await edit('src/app/App.tsx',[
 ["import { ExecutionGate } from '../core/resources/execution';","import { ExecutionGate } from '../core/resources/execution';\nimport {getDesktopPlatform} from '../adapters/platform';\nimport {DesktopPrivacy} from '../desktop/Privacy';"],
 ['useState(()=>({budget:new ResourceBudget(),execution:new ExecutionGate()}))','useState(()=>getDesktopPlatform()?.resources??({budget:new ResourceBudget(),execution:new ExecutionGate()}))'],
 ["const importFiles = (files: readonly File[]) => {setImportError(undefined);if(mode==='image')void queue.add(new WebFileInputAdapter().readMany(files)).then(activateImages);else void phase5.coordinator.add(files.map(toP5Input)).catch(error=>setImportError(errorCode(error)));};", "const importFiles = async (files: readonly File[]) => {setImportError(undefined);if(mode==='image')await queue.add(new WebFileInputAdapter().readMany(files)).then(activateImages);else await phase5.coordinator.add(files.map(toP5Input)).catch(error=>setImportError(errorCode(error)));};\n  useEffect(()=>getDesktopPlatform()?.importer(mode==='ai-ready'?async files=>{await ai.queue.add(new WebFileInputAdapter().readMany(files));}:importFiles));"],
 ['<span className="web-badge">WEB</span>',"<span className=\"web-badge\">{getDesktopPlatform()?'DESKTOP':'WEB'}</span>"],
 ["onFiles={files=>void ai.queue.add(new WebFileInputAdapter().readMany(files))}","onFiles={async files=>{await ai.queue.add(new WebFileInputAdapter().readMany(files));}}"],
 ["<p>{t('privacyProcessing')}</p>","{getDesktopPlatform()&&<DesktopPrivacy/>}<p>{t('privacyProcessing')}</p>"]]);
for(const [path,importPath,handler]of[
 ['src/components/Dropzone.tsx','../adapters/platform','onFiles'],
 ['src/components/ai-ready/Workspace.tsx','../../adapters/platform','onFiles'],
 ['src/components/Workspace.tsx','../adapters/platform',"async files=>{const id=restoreId.current;restoreId.current=undefined;if(id&&files[0]){const file=files[0];await queue.restore(id,{name:file.name,size:file.size,type:file.type,blob:file});if(files.length>1)await onFiles(files.slice(1));}else await onFiles(files);}"],
 ['src/components/phase5/Workspace.tsx','../../adapters/platform',"async files=>{const id=restoreId.current;restoreId.current=undefined;if(id&&files[0]){const file=files[0];await coordinator.legacy.restore(id,{name:file.name,size:file.size,type:file.type,blob:file});if(files.length>1)await onFiles(files.slice(1));}else await onFiles(files);}"],
 ['src/components/phase5/Utilities.tsx','../../adapters/platform',"async files=>{const file=files[0];if(file)await coordinator.addUtility(toP5Input(file),operation(action)).then(()=>{setError(undefined);setOpen(false);},e=>setError(errorCode(e)));}"]
])await edit(path,[["type=\"file\"",`type="file" onClick={event=>nativeFileClick(event,${handler})}`],["import ",`import {nativeFileClick} from '${importPath}';\nimport `]]);
await edit('src/hooks/useTheme.ts',[["import { useEffect", "import {getDesktopPlatform} from '../adapters/platform';\nimport { useEffect"],["localStorage.setItem('fileflow-theme', value);","localStorage.setItem('fileflow-theme', value);getDesktopPlatform()?.preference('fileflow-theme',value);"]]);
await edit('src/i18n/Provider.tsx',[["import { createContext", "import {getDesktopPlatform} from '../adapters/platform';\nimport { createContext"],["localStorage.setItem(LANGUAGE_KEY, value);","localStorage.setItem(LANGUAGE_KEY, value);getDesktopPlatform()?.preference('fileflow-language',value);"]]);
console.log('Connected platform UI boundaries; no conversion or AI Ready algorithm files edited.');
