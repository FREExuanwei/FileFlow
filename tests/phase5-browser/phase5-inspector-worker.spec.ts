import {test,expect} from './phase5-harness';
test('basic inspection never reads fictional PDF body and does not load PDF Worker',async({page,external})=>{
  void external;const workers:string[]=[];page.on('worker',w=>workers.push(w.url()));await page.goto('/tests/phase5-browser/phase5-inspector.html');await page.locator('#input').setInputFiles('tests/fixtures/demo.pdf');await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  const fields=JSON.parse(await page.locator('#report').innerText());expect(fields.signature).toBe('not-checked');expect(typeof fields.lastModified).toBe('number');expect(fields.author).toBe('not-checked');expect(workers).toEqual([]);expect(await page.locator('#report').innerText()).not.toContain('FileFlow Demo PDF');
});
for(const [file,signature] of [['demo.pdf','pdf'],['no-text.pdf','pdf'],['demo.png','png'],['fictional.jpg','jpeg'],['fictional.webp','webp']] as const)test(`explicit structure ${file} reads no body preview and releases`,async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-inspector.html');
  if(signature==='jpeg'||signature==='webp'){
    const bytes=await page.evaluate(async mime=>{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=16;canvas.getContext('2d')!.fillRect(2,2,10,10);const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),mime));return Array.from(new Uint8Array(await blob.arrayBuffer()));},`image/${signature}`);
    await page.locator('#input').setInputFiles({name:file,mimeType:`image/${signature}`,buffer:Buffer.from(bytes)});
  }else await page.locator('#input').setInputFiles(`tests/fixtures/${file}`);
  await page.locator('#structural').check();await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  const fields=JSON.parse(await page.locator('#report').innerText());expect(fields.signature).toBe(signature);if(signature==='pdf')expect(fields.pages).toBe(1);else{expect(fields.width).toBeGreaterThan(0);expect(fields.height).toBeGreaterThan(0);}expect(Object.keys(fields)).not.toContain('text');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');
});
test('untrusted declared MIME and unknown bytes remain unconfirmed',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-inspector.html');await page.locator('#input').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:Buffer.from('fictional binary')});await page.locator('#structural').check();await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');expect(JSON.parse(await page.locator('#report').innerText())).toMatchObject({signature:'unknown',declaredMime:'image/png',mimeMatch:false});
});
test('PDF inspector cancellation has no stale report and settles resource cleanup',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-inspector.html');await page.locator('#input').setInputFiles('tests/fixtures/demo.pdf');await page.locator('#structural').check();await page.evaluate(()=>{(document.querySelector('#run') as HTMLButtonElement).click();(document.querySelector('#cancel') as HTMLButtonElement).click();});await expect(page.locator('#status')).toHaveText('cancel');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#report')).toBeEmpty();
});
