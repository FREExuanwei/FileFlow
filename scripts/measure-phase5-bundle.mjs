import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
export function measurePhase5Bundle(root,baseline){
  if(!baseline.verifiedRun||!Array.isArray(baseline.bundle))throw Error('Missing sealed bundle baseline');
  const directory=join(root,'dist/assets'),files=new Map(readdirSync(directory).filter(name=>name.endsWith('.js')).map(name=>[name,readFileSync(join(directory,name),'utf8')]));
  const html=readFileSync(join(root,'dist/index.html'),'utf8'),entry=html.match(/<script[^>]+src="[^"]*\/([^/]+\.js)"/)?.[1];if(!entry||!files.has(entry))throw Error('Missing application entry');
  const imports=name=>[...(files.get(name)??'').matchAll(/(?:from\s*|import\s*)["'`]([.][^"'`]+\.js)["'`]/g)].map(m=>basename(m[1]));
  const references=name=>[...(files.get(name)??'').matchAll(/["'`]([^"'`\s]+\.js)["'`]/g)].map(m=>basename(m[1])).filter(n=>files.has(n));
  const closure=(roots,edges)=>{const found=new Set(),walk=name=>{if(found.has(name)||!files.has(name))return;found.add(name);for(const next of edges(name))walk(next);};roots.forEach(walk);return[...found];};
  const sum=names=>names.reduce((n,name)=>n+gzipSync(files.get(name)).length,0);
  const initial=closure([entry],imports),oldEntry=baseline.bundle.filter(file=>/^dist\/assets\/index-[^/]+\.js$/.test(file.path));if(oldEntry.length!==1||!Number.isSafeInteger(oldEntry[0].gzipBytes))throw Error('Missing exact original entry measurement');
  const xlsx=closure([...files.keys()].filter(n=>/^phase5-xlsx\.worker-/.test(n)),references),yaml=closure([...files.keys()].filter(n=>/^phase5-yaml\.worker-/.test(n)),references);
  const manifestPath=join(root,'dist/.vite/manifest.json');let bridge=[],reused=[];
  if(existsSync(manifestPath)){const manifest=read(manifestPath);bridge=[...new Set(Object.entries(manifest).filter(([key])=>/^src\/(?:components|converters|hooks|core)\/phase5\//.test(key)).map(([,value])=>basename(value.file)).filter(name=>files.has(name)&&!initial.includes(name)&&!xlsx.includes(name)&&!yaml.includes(name)))];
    const pdf=manifest['node_modules/pdfjs-dist/legacy/build/pdf.mjs'];
    if(pdf){const previous=baseline.bundle.filter(file=>/^dist\/assets\/pdf-[^/]+\.js$/.test(file.path));if(previous.length!==1)throw Error('Missing original PDF library baseline');reused=[{file:basename(pdf.file),baselineGzip:previous[0].gzipBytes,gzipBytes:sum([basename(pdf.file)]),increment:Math.max(0,sum([basename(pdf.file)])-previous[0].gzipBytes)}];}
  }
  const originalFiles=new Set(baseline.bundle.map(file=>basename(file.path)));
  bridge=closure([...bridge,...[...files.keys()].filter(n=>/^phase5-(?:data|hash)\.worker-/.test(n))],imports).filter(name=>!initial.includes(name)&&!xlsx.includes(name)&&!yaml.includes(name)&&!originalFiles.has(name)&&!reused.some(item=>item.file===name));
  const entryIncrement=sum(initial)-oldEntry[0].gzipBytes,checks={entry:{files:initial,gzipBytes:sum(initial),baselineGzip:oldEntry[0].gzipBytes,increment:entryIncrement,limit:12*1024,pass:entryIncrement<=12*1024},xlsx:{files:xlsx,gzipBytes:sum(xlsx),limit:400*1024,pass:xlsx.length>0&&sum(xlsx)<=400*1024},yaml:{files:yaml,gzipBytes:sum(yaml),limit:50*1024,pass:yaml.length>0&&sum(yaml)<=50*1024},bridge:{files:bridge,gzipBytes:sum(bridge)+Math.max(0,entryIncrement),limit:40*1024,pass:existsSync(manifestPath)&&sum(bridge)+Math.max(0,entryIncrement)<=40*1024}};
  checks.bridge.gzipBytes+=reused.reduce((total,item)=>total+item.increment,0);checks.bridge.pass=existsSync(manifestPath)&&checks.bridge.gzipBytes<=checks.bridge.limit;
  return{checks,reused,pass:Object.values(checks).every(check=>check.pass),method:'Unique gzip chunks per group including backtick dynamic imports. Bridge includes owned modules and shared static dependencies. Existing pinned PDF.js is charged only its measured delta against the sealed baseline; source/lock integrity is independently frozen.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const root=process.cwd(),at=process.argv.indexOf('--baseline'),report=measurePhase5Bundle(root,read(at>=0?process.argv[at+1]:'docs/phase5/baseline.json')),outAt=process.argv.indexOf('--output');if(outAt>=0)writeFileSync(process.argv[outAt+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
