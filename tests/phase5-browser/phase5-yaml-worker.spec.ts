import {readFileSync} from 'node:fs';
import {parseDocument} from 'yaml';
import {test,expect} from './phase5-harness';
for(const [route,source,value] of [
  ['yaml-to-json','base: &b [1, two]\ncopy: *b\ndate: 2026-01-02\n',{base:[1,'two'],copy:[1,'two'],date:'2026-01-02'}],
  ['json-to-yaml','{"title":"虚构","array":[null,true,42]}',{title:'虚构',array:[null,true,42]}],
] as const)test(`real local YAML Worker ${route} download reparses`,async({page,external})=>{
  void external;const workers:string[]=[];page.on('worker',w=>workers.push(w.url()));await page.goto('/tests/phase5-browser/phase5-yaml.html');await page.locator('#route').selectOption(route);
  await page.locator('#input').setInputFiles({name:route==='yaml-to-json'?'fictional.yaml':'fictional.json',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  const pending=page.waitForEvent('download');await page.locator('#download').click();const bytes=readFileSync((await(await pending).path())!,'utf8');
  expect(route==='yaml-to-json'?JSON.parse(bytes):parseDocument(bytes).toJS()).toEqual(value);expect(workers.some(url=>url.includes('phase5-yaml.worker'))).toBe(true);
  await expect(page.locator('#status')).toHaveAttribute('data-transient','0');
});
for(const [name,source] of [['cycle','a: &a [*a]'],['multiple','a: 1\n---\nb: 2'],['tag','a: !!timestamp 2026-01-02'],['weighted','a: &a [1]\nb: &b [*a,*a,*a,*a,*a]\nc: [*b,*b,*b,*b,*b]']] as const)test(`real YAML Worker rejects ${name} and releases resources`,async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-yaml.html');await page.locator('#input').setInputFiles({name:'fictional.yaml',mimeType:'application/yaml',buffer:Buffer.from(source)});await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText(/structure|size/);await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#download')).toBeHidden();
});
test('real YAML Worker cancellation and clear never publish stale results',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-yaml.html');await page.locator('#input').setInputFiles({name:'fictional.yaml',mimeType:'application/yaml',buffer:Buffer.from('['+Array(99900).fill('0').join(',')+']')});
  await page.evaluate(()=>{(document.querySelector('#run') as HTMLButtonElement).click();(document.querySelector('#cancel') as HTMLButtonElement).click();});
  await expect(page.locator('#status')).toHaveText('cancel');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#download')).toBeHidden();
  await page.locator('#clear').click();await expect(page.locator('#status')).toHaveText('cleared');await expect(page.locator('#preview')).toBeEmpty();
});
