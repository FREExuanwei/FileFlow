import {test,expect} from './phase5-harness';
import {fictionalWorkbook} from '../../scripts/phase5-xlsx-fixtures.mjs';
for(const multi of [false,true])test(`real XLSX Worker ${multi?'multi hidden':'single'} metadata`,async({page,external})=>{
  void external;const workers:string[]=[];page.on('worker',w=>workers.push(w.url()));await page.goto('/tests/phase5-browser/phase5-xlsx.html');
  const sheets=multi?[{name:'Visible',state:'visible'},{name:'Hidden',state:'hidden'},{name:'VeryHidden',state:'veryHidden'}]:[{name:'Fictional',state:'visible'}];
  await page.locator('#input').setInputFiles({name:'fictional.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fictionalWorkbook({sheets,deflate:true}).bytes});await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');
  expect(JSON.parse((await page.locator('#preview').textContent())!).sheets).toEqual(sheets.map((s,i)=>({id:`rId${i+1}`,name:s.name,visibility:s.state})));await expect(page.locator('#status')).toHaveAttribute('data-transient','0');expect(workers.some(s=>s.includes('phase5-xlsx.worker'))).toBe(true);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/xlsx\.mjs/.test(r.name)))).toBe(false);
});
test('real XLSX Worker guard rejects malicious XML',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-xlsx.html');await page.locator('#input').setInputFiles({name:'fictional.xlsx',mimeType:'application/octet-stream',buffer:fictionalWorkbook({extra:{'xl/attack.xml':'<!DOCTYPE a><a/>'}}).bytes});await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('structure');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#preview')).toBeEmpty();
});
test('cancel/clear prevent late XLSX metadata and release reservation',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-xlsx.html');await page.locator('#input').setInputFiles({name:'fictional.xlsx',mimeType:'application/octet-stream',buffer:fictionalWorkbook().bytes});
  await page.evaluate(()=>{(document.querySelector('#run') as HTMLButtonElement).click();(document.querySelector('#cancel') as HTMLButtonElement).click();});await expect(page.locator('#status')).toHaveText('cancel');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#preview')).toBeEmpty();
  await page.evaluate(()=>{(document.querySelector('#run') as HTMLButtonElement).click();(document.querySelector('#clear') as HTMLButtonElement).click();});await expect(page.locator('#status')).toHaveText('cleared');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#preview')).toBeEmpty();
});
