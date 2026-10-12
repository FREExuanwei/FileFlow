import {readFileSync} from 'node:fs';
import {test,expect} from './phase5-harness';
for(const [route,source,expected] of [
  ['tsv-to-csv','name\tvalue\r\n虚构\t42','name,value\r\n虚构,42'],
  ['tsv-to-json','__proto__\tconstructor\tprototype\r\none\ttwo\tthree','[\n  {\n    "__proto__": "one",\n    "constructor": "two",\n    "prototype": "three"\n  }\n]'],
  ['json-to-tsv','[{"n":-42,"text":"-42"}]','n\ttext\r\n-42\t\'-42'],
] as const)test(`real Worker ${route} downloads exact bytes`,async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-worker.html');await page.locator('#route').selectOption(route);
  await page.locator('#input').setInputFiles({name:route==='json-to-tsv'?'fictional.json':'fictional.tsv',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  const pending=page.waitForEvent('download');await page.locator('#download').click();expect(readFileSync((await(await pending).path())!,'utf8')).toBe(expected);
  await expect(page.locator('#status')).toHaveAttribute('data-transient','0');
});
test('real Worker rejects malformed UTF8 without retaining transient or publishing a download',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-worker.html');await page.locator('#input').setInputFiles('tests/phase5-fixtures/invalid-utf8.csv');await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('utf8');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#download')).toBeHidden();
});
test('real local Papa Worker exports fictional TSV and releases transient budget',async({page,external})=>{
  void external;const workers:string[]=[];page.on('worker',w=>workers.push(w.url()));await page.goto('/tests/phase5-browser/phase5-worker.html');
  await page.locator('#input').setInputFiles({name:'fictional.csv',mimeType:'text/csv',buffer:Buffer.from('name,value\r\n虚构,42')});
  await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  const pending=page.waitForEvent('download');await page.locator('#download').click();const saved=await pending;
  expect(readFileSync((await saved.path())!,'utf8')).toBe('name\tvalue\r\n虚构\t42');expect(workers.some(url=>url.includes('phase5-data.worker'))).toBe(true);
  await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await page.locator('#clear').click();await expect(page.locator('#download')).toBeHidden();
});
