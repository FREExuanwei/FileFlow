import {test,expect} from './phase5-harness';
import {semanticWorkbook} from '../../scripts/phase5-xlsx-fixtures.mjs';
import {readFileSync} from 'node:fs';
test('real XLSX compact values are identical across three timezones and both date systems',async({browser,external})=>{
  void external;for(const date1904 of [false,true]){const outputs:string[]=[];for(const timezoneId of ['Asia/Tokyo','Asia/Shanghai','America/New_York']){
    const context=await browser.newContext({timezoneId});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4174'?route.continue():route.abort());
    try{const page=await context.newPage();await page.goto('http://127.0.0.1:4174/tests/phase5-browser/phase5-xlsx.html');await page.locator('#normalize').check();await page.locator('#input').setInputFiles({name:'fictional.xlsx',mimeType:'application/octet-stream',buffer:semanticWorkbook(date1904).bytes});await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');const text=(await page.locator('#preview').textContent())!,value=JSON.parse(text);expect(value.rows[1].map((c:{raw:unknown})=>c.raw)).toEqual([date1904?44840:46302,3,null,true]);expect(value.rows[1][0].display).toBe('2026-10-07');expect(value.notices).toContainEqual({code:'xlsx-formula-missing',count:1});expect(text).not.toContain('1+2');expect(text).not.toContain('2+3');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');outputs.push(text);}finally{await context.close();}
  }expect(new Set(outputs).size).toBe(1);}
});
test('real exported CSV/JSON bytes are timezone independent with original serials',async({browser,external})=>{
  void external;const outbound:string[]=[];
  for(const date1904 of [false,true])for(const target of ['csv','json']){
    const outputs:Buffer[]=[];
    for(const timezoneId of ['Asia/Tokyo','Asia/Shanghai','America/New_York']){
      const context=await browser.newContext({timezoneId});context.on('request',request=>{if(new URL(request.url()).origin!=='http://127.0.0.1:4174')outbound.push(request.url());});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4174'?route.continue():route.abort());
      try{const page=await context.newPage();await page.goto('http://127.0.0.1:4174/tests/phase5-browser/phase5-xlsx.html');await page.locator('#action').selectOption(`xlsx-to-${target}`);await page.locator('#input').setInputFiles({name:'fictional.xlsx',mimeType:'application/octet-stream',buffer:semanticWorkbook(date1904).bytes});await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('completed');const pending=page.waitForEvent('download');await page.locator('#download').click();const output=readFileSync((await(await pending).path())!);outputs.push(output);expect(output.toString('utf8')).toBe(target==='csv'?'date,cached,missing,flag\r\n2026-10-07,3,,TRUE':JSON.stringify([{date:date1904?44840:46302,cached:3,missing:null,flag:true}],null,2));}finally{await context.close();}
    }
    expect(outputs.every(bytes=>bytes.equals(outputs[0]!))).toBe(true);
  }
  expect(outbound).toEqual([]);
});

