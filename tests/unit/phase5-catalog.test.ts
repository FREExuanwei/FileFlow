import {expect,it} from 'vitest';
import {converters} from '../../src/core/registry';
import {activeCatalog,recommendedRoute} from '../../src/core/phase5/catalog';
import {detectP5Format} from '../../src/core/phase5/detect';
it('retains original14 and composes22 admitted routes with no utility fakes',()=>{expect(converters).toHaveLength(14);const routes=activeCatalog({yaml:true,xlsx:true});expect(routes).toHaveLength(22);expect(new Set(routes.map(r=>r.id)).size).toBe(22);expect(routes.filter(r=>r.owner==='legacy').map(r=>r.converter)).toEqual(converters);expect(routes.every(r=>r.id.includes('-to-'))).toBe(true);});
it('blocked groups have no runnable descriptors',()=>{expect(activeCatalog({yaml:true,xlsx:false})).toHaveLength(20);expect(activeCatalog({yaml:false,xlsx:false})).toHaveLength(18);expect(activeCatalog({yaml:true,xlsx:false}).some(r=>r.input==='xlsx')).toBe(false);});
for(const [format,target] of [['json','csv'],['csv','json'],['tsv','json'],['yaml','json'],['xlsx','csv']] as const)it(`smart default ${format}→${target}`,()=>{expect(recommendedRoute(format,{yaml:true,xlsx:true})?.output).toBe(target);});
it('new formats recognize exact extensions/MIME and do not admit TXT',async()=>{
  for(const name of ['fiction.tsv','fiction.yaml','fiction.yml','fiction.xlsx']){const blob=new Blob(['fiction']);expect(await detectP5Format({name,type:'application/octet-stream',size:blob.size,blob})).toBe(name.endsWith('yml')?'yaml':name.split('.').pop());}
  const blob=new Blob(['fiction']);expect(await detectP5Format({name:'fiction.txt',type:'text/plain',size:blob.size,blob})).toBeUndefined();await expect(detectP5Format({name:'fiction.xlsx',type:'text/html',size:blob.size,blob})).rejects.toThrow();
});
