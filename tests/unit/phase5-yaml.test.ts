import {describe,it,expect} from 'vitest';
import {parseDocument} from 'yaml';
import {convertSafeYaml} from '../../src/converters/phase5/yaml';
describe('Safe YAML positive contract',()=>{
  it('round trips JSON primitives, nested arrays, Unicode and date-like strings deterministically',()=>{
    const value={title:'虚构',date:'2026-01-02',array:[null,true,false,12,-42,1.25,{nested:'two'}]};
    const first=convertSafeYaml('json-to-yaml',JSON.stringify(value));
    expect(first.text.endsWith('\n')).toBe(true);expect(first.text.endsWith('\n\n')).toBe(false);expect(first.text).not.toContain('\r');
    expect(first).toEqual(convertSafeYaml('json-to-yaml',JSON.stringify(value)));
    expect(parseDocument(first.text).toJS()).toEqual(value);
    expect(JSON.parse(convertSafeYaml('yaml-to-json',first.text).text)).toEqual(value);
  });
  it('allows simple aliases under syntax and weighted expansion limits',()=>{
    expect(JSON.parse(convertSafeYaml('yaml-to-json','base: &b [1, two]\ncopy: *b\n').text)).toEqual({base:[1,'two'],copy:[1,'two']});
  });
  it('documents comment and layout loss without leaking source text',()=>{
    const result=convertSafeYaml('yaml-to-json','# fictional private-looking comment\na: 1\n');
    expect(result.notices).toContainEqual({code:'yaml-layout-loss'});expect(result.text).not.toContain('comment');
  });
  it('preserves safe integer boundary and treats dates as strings',()=>{
    expect(JSON.parse(convertSafeYaml('yaml-to-json','n: 9007199254740991\nd: 2026-01-02\n').text)).toEqual({n:Number.MAX_SAFE_INTEGER,d:'2026-01-02'});
  });
});
