import {test as base,expect} from '@playwright/test';
export const test=base.extend<{external:string[]}>({external:async({context},use)=>{
  const external:string[]=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin==='http://127.0.0.1:4174')return route.continue();external.push(url.origin);return route.abort();});await use(external);expect(external).toEqual([]);
}});
export {expect};
