import {afterEach,expect,it,vi} from 'vitest';
import {Phase5OutputAdapter} from '../../src/adapters/web/phase5-output';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('blocked download releases URL/anchor immediately but does not consume the Blob',()=>{
  const create=vi.fn(()=> 'blob:fictional'),revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:create,revokeObjectURL:revoke});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{throw Error('blocked');});const blob=new Blob(['fiction']),adapter=new Phase5OutputAdapter();expect(()=>adapter.save(blob,'fiction.txt')).toThrow('blocked');expect(revoke).toHaveBeenCalledWith('blob:fictional');expect(document.querySelector('a[download]')).toBeNull();expect(blob.size).toBe(7);adapter.dispose();expect(revoke).toHaveBeenCalledTimes(1);
});
it('normal download/dispose revokes each tracked URL once',()=>{vi.useFakeTimers();const revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:()=> 'blob:fictional',revokeObjectURL:revoke});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});const adapter=new Phase5OutputAdapter();adapter.save(new Blob(['fiction']),'fiction.txt');adapter.dispose();vi.runAllTimers();expect(revoke).toHaveBeenCalledTimes(1);expect(document.querySelector('a[download]')).toBeNull();});
