import {readFileSync} from 'node:fs';
import {test,expect} from './phase5-harness';
test('one real Worker performs three JSON actions and retains idle accounting until clear',async({page,external})=>{
  void external;let workers=0;page.on('worker',()=>workers++);await page.goto('/tests/phase5-browser/phase5-json.html');
  await page.locator('#input').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:Buffer.from(' {"fictional":[1,true,null]} ')});
  for(const [action,expected] of [['format','{\n  "fictional": [\n    1,\n    true,\n    null\n  ]\n}'],['minify','{"fictional":[1,true,null]}']] as const){
    await page.locator('#'+action).click();await expect(page.locator('#status')).toHaveText('completed');const pending=page.waitForEvent('download');await page.locator('#download').click();expect(readFileSync((await(await pending).path())!,'utf8')).toBe(expected);
    await expect(page.locator('#status')).toHaveAttribute('data-transient',String(64*1024**2));
  }
  await page.locator('#validate').click();await expect(page.locator('#status')).toHaveText('valid');await expect(page.locator('#download')).toBeHidden();expect(workers).toBe(1);
  await page.locator('#clear').click();await expect(page.locator('#status')).toHaveAttribute('data-transient','0');
});
test('duplicate keys report the safe subset, cancellation and replacing source never commit stale results',async({page,external})=>{
  void external;await page.goto('/tests/phase5-browser/phase5-json.html');
  await page.locator('#input').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:Buffer.from('{"same":1,"same":2}')});await page.locator('#validate').click();await expect(page.locator('#status')).toHaveText('invalid');await expect(page.locator('#preview')).toContainText('json-duplicate-key');await expect(page.locator('#preview')).toContainText('FileFlow safe JSON subset');
  await page.locator('#input').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:Buffer.from('{"replacement":true}')});
  await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#format')!.click();document.querySelector<HTMLButtonElement>('#cancel')!.click();});await expect(page.locator('#status')).toHaveText('cancel');await expect(page.locator('#status')).toHaveAttribute('data-transient','0');await expect(page.locator('#download')).toBeHidden();
  await page.locator('#format').click();await expect(page.locator('#status')).toHaveText('completed');await expect(page.locator('#preview')).toContainText('replacement');await expect(page.locator('#preview')).not.toContainText('same');await page.locator('#clear').click();
});
