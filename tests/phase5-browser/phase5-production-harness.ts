import {test as base,expect,type Page} from '@playwright/test';
import {privacyViolations,type RequestRecord} from '../../scripts/phase5-privacy-policy.mjs';
export const test=base.extend<{privacyAudit:RequestRecord[]}>({privacyAudit:[async({context,page},use,testInfo)=>{
  const requests:RequestRecord[]=[];context.on('request',request=>requests.push({url:request.url(),method:request.method(),type:request.resourceType()}));
  await context.route('**/*',route=>privacyViolations([{url:route.request().url(),method:route.request().method(),type:route.request().resourceType()}]).length?route.abort():route.continue());
  await page.addInitScript(()=>{const Native=Worker;let active=0,created=0;const urls:string[]=[];class Tracked extends Native{private dead=false;constructor(url:string|URL,options?:WorkerOptions){super(url,options);active++;created++;urls.push(String(url));}terminate(){if(!this.dead){this.dead=true;active--;}super.terminate();}}Object.defineProperty(window,'Worker',{value:Tracked});Object.defineProperty(window,'p5Workers',{value:{get active(){return active;},get created(){return created;},urls}});});
  await use(requests);expect(privacyViolations(requests)).toEqual([]);await testInfo.attach('runtime-network',{body:JSON.stringify({browser:context.browser()?.version(),requests}),contentType:'application/json'});
},{auto:true}]});
export {expect};
export async function openEnglish(page:Page){await page.goto('/');await page.getByRole('combobox',{name:/语言|Interface language/}).selectOption('en');}
export async function importTool(page:Page,tool:string,name:string,buffer:Buffer){await page.getByRole('button',{name:'File utilities',exact:true}).click();await page.getByLabel('Tool',{exact:true}).selectOption(tool);await page.getByLabel('Choose a file for utilities').setInputFiles({name,mimeType:'application/octet-stream',buffer});}
export const runTool=(page:Page)=>page.getByRole('button',{name:'Run tool',exact:true}).click();
export const workers=(page:Page)=>page.evaluate(()=>Reflect.get(window,'p5Workers') as {active:number;created:number;urls:string[]});
