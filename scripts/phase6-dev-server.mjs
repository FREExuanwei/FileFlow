import {createServer} from 'vite';
import {readdir, mkdir, writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

// This regression runner measures conversions after dev compilation is ready.
// It transforms source only: no browser, Worker, fixture, or conversion is run.
const evidenceDir=process.env.PHASE65_REGRESSION==='1'?'docs/phase65/development-regression':'docs/phase6/development-regression';
const browser=process.env.PHASE6_BROWSER ?? 'combined';
if(!['edge','chrome','combined'].includes(browser))throw new Error('Invalid PHASE6_BROWSER');
const start=performance.now();
let ready=false;
const server=await createServer({
  server:{host:'127.0.0.1',port:4174,strictPort:true},
  plugins:[{name:'phase6-readiness',configureServer(instance){
    instance.middlewares.use('/__phase6_ready',(_request,response)=>{
      response.statusCode=ready?200:503;
      response.end(ready?'Phase6 compilation ready':'Phase6 compiling');
    });
  }}],
});
const entries=(await readdir('tests/phase5-browser')).filter(name=>name.endsWith('-entry.ts')).map(name=>`/tests/phase5-browser/${name}`);
const workers=(await readdir('src/workers')).filter(name=>/^phase5-.*\.worker\.ts$/.test(name)).map(name=>`/src/workers/${name}?worker_file&type=module`);
const roots=['/src/main.tsx',...entries,...workers,'/tests/phase5-browser/phase5-xlsx-probe.worker.ts?worker_file&type=module'];
const transformed=[];
const seen=new Set();
try{
  await server.listen();
  // Await each root and each discovered import. waitForRequestsIdle also settles
  // Vite's automatically scheduled static import pre-transforms.
  const pending=[...roots];
  while(pending.length){
    const url=pending.shift();
    if(seen.has(url))continue;
    seen.add(url);
    const before=performance.now();
    await server.warmupRequest(url);
    const result=await server.transformRequest(url);
    if(!result)throw new Error(`No transform result for ${url}`);
    transformed.push({url,milliseconds:Math.round(performance.now()-before)});
    const module=await server.environments.client.moduleGraph.getModuleByUrl(url);
    for(const dependency of module?.importedModules ?? []){
      if(dependency.url.startsWith('/'))pending.push(dependency.url);
    }
  }
  await server.waitForRequestsIdle();
  await mkdir(evidenceDir,{recursive:true});
  await writeFile(`${evidenceDir}/${browser}-warmup.json`,JSON.stringify({
    generatedAt:new Date().toISOString(),mode:'Vite development, compiler warmup before test readiness',
    noInputConversion:true,roots,transformed,totalMilliseconds:Math.round(performance.now()-start),
  },null,2)+'\n');
  ready=true;
  console.log(`PHASE6_READY: compiler warmup completed (${transformed.length} modules, ${Math.round(performance.now()-start)} ms); no conversion inputs executed`);
}catch(error){await server.close();throw error;}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void server.close().then(()=>process.exit(0));});
