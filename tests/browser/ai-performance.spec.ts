import {test,expect,enterAi,openAiExports} from './ai-harness';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const pattern='# Fictional section 虚构章节\n\nFictional English sentence with local-only data. 这是虚构内容。\n\n- Fictional item\n- Another item\n\n```js\nconst fictional = 1;\n```\n\n';
for(const [name,bytes]of [['small',4096],['medium',512*1024],['large',4*1024**2]] as const)test(`real Worker performance ${name}`,async({page})=>{
  test.setTimeout(220000);const buffer=Buffer.from(pattern.repeat(Math.floor(bytes/Buffer.byteLength(pattern)))),runs:{milliseconds:number;estimatedTokens:number;chunks:number}[]=[];await enterAi(page);
  for(let i=0;i<3;i++){
    await page.locator('input[type=file]').setInputFiles({name:`fictional-${name}.txt`,mimeType:'text/plain',buffer});await expect(page.locator('.ai-process')).toBeEnabled();const start=performance.now();await page.locator('.ai-process').click();await expect(page.locator('.queue-row:is([data-status=completed],[data-status=warning])')).toHaveCount(1,{timeout:65000});const milliseconds=performance.now()-start;
    await openAiExports(page);const waiting=page.waitForEvent('download');await page.locator('.ai-export-list').getByRole('button',{name:'Download metadata.json',exact:true}).click();const metadata=JSON.parse(readFileSync((await(await waiting).path())!,'utf8'));runs.push({milliseconds,estimatedTokens:metadata.tokenEstimate.afterEstimatedTokens,chunks:metadata.chunks.length});await page.locator('.ai-clear').click();await expect(page.locator('.queue-row')).toHaveCount(0);
  }
  expect(new Set(runs.map(r=>r.estimatedTokens)).size).toBe(1);expect(new Set(runs.map(r=>r.chunks)).size).toBe(1);mkdirSync('docs/phase3',{recursive:true});writeFileSync(`docs/phase3/performance-${name}.json`,JSON.stringify({name,inputBytes:buffer.byteLength,characters:Array.from(buffer.toString()).length,runs,medianMilliseconds:[...runs].map(r=>r.milliseconds).sort((a,b)=>a-b)[1]},null,2));
});
