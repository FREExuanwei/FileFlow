import { test as base,expect,type Page } from '@playwright/test';
export {expect};
export const test=base.extend<{privacyGuard:void}>({privacyGuard:[async({context,page},use)=>{
  const unexpected:string[]=[];
  context.on('request',request=>{if(/^https?:/.test(request.url())&&(new URL(request.url()).origin!=='http://127.0.0.1:4174'||request.method()!=='GET'))unexpected.push(`${request.method()} ${request.url()}`);});
  await use();
  expect(unexpected).toEqual([]);
  if(!page.isClosed()&&page.url().startsWith('http')){
    const storage=await page.evaluate(async()=>({local:Object.keys(localStorage).filter(key=>!['fileflow.language','fileflow-theme'].includes(key)),session:Object.keys(sessionStorage),databases:await indexedDB.databases()}));
    expect(storage).toEqual({local:[],session:[],databases:[]});expect(await context.cookies()).toEqual([]);
  }
},{auto:true}]});
export async function enterAi(page:Page){await page.goto('/');await page.getByRole('button',{name:'AI Ready',exact:true}).click();}
export async function openAiAdvanced(page:Page){const details=page.locator('.ai-advanced');if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope>summary').click();}
export async function openAiExports(page:Page){const details=page.locator('.ai-export-details');if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope>summary').click();}
export async function processFixture(page:Page,name:string){await page.locator('.ai-workspace input[type=file]').setInputFiles(`tests/fixtures/${name}`);await expect(page.locator('.ai-process')).toBeEnabled();await page.locator('.ai-process').click();await expect(page.locator('.ai-clean-summary')).toBeVisible();}
