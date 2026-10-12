import {afterEach,describe,it,expect,vi} from 'vitest';
import {Document} from 'yaml';
import {convertSafeYaml} from '../../src/converters/phase5/yaml';
afterEach(()=>vi.restoreAllMocks());
describe('Safe YAML rejects before materialization',()=>{
  const attacks:Record<string,string>={
    recursive:'a: &a [*a]',
    unresolved:'a: *missing',
    'weighted aliases over20':'a: &a [1]\nb: &b ['+Array(5).fill('*a').join(',')+']\nc: ['+Array(5).fill('*b').join(',')+']',
    'alias chain depth':Array.from({length:66},(_,i)=>`a${i}: &a${i} ${i?`[*a${i-1}]`:'[1]'}`).join('\n'),
    'anchor limit':Array.from({length:21},(_,i)=>`a${i}: &a${i} ${i}`).join('\n'),
    'alias AST limit':'a: &a 1\nb: ['+Array(21).fill('*a').join(',')+']',
    'depth65':'['.repeat(65)+'0'+']'.repeat(65),
    'nodes100001':'['+Array(100000).fill('0').join(',')+']',
    'expanded nodes exceed limit with only two aliases':'a: &a ['+Array(40000).fill('0').join(',')+']\nb: [*a, *a]',
    'expanded depth with only ten aliases':'a0: &a0 '+'['.repeat(56)+'0'+']'.repeat(56)+'\n'+Array.from({length:10},(_,i)=>`a${i+1}: &a${i+1} [*a${i}]`).join('\n'),
    'scalar units':'a: '+ 'x'.repeat(256*1024+1),
    'explicit function tag':'a: !!js/function function(){}',
    'custom tag':'a: !custom test',
    'timestamp tag':'a: !!timestamp 2026-01-01',
    'binary tag':'a: !!binary YQ==',
    'core explicit tag':'a: !!str test',
    merge:'a: &a {b: 1}\nc: {<<: *a}',
    'multiple documents':'a: 1\n---\nb: 2',
    'duplicate keys':'a: 1\na: 2',
    'prototype key':'__proto__: 1',constructor:'constructor: 1',prototype:'prototype: 1',
    'non-string key':'1: two',
    'complex key':'? [a, b]\n: two',
    'unsafe integer':'a: 9007199254740993',
    infinity:'a: .inf',nan:'a: .nan',
    'YAML1.1':'%YAML 1.1\n---\na: yes',
    warning:'a: "\\z"',
  };
  for(const [name,text] of Object.entries(attacks))it(name,()=>{
    const spy=vi.spyOn(Document.prototype,'toJS');
    expect(()=>convertSafeYaml('yaml-to-json',text)).toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  for(const key of ['__proto__','constructor','prototype'])it(`rejects JSON ${key} on YAML export`,()=>{
    expect(()=>convertSafeYaml('json-to-yaml',`{"${key}":1}`)).toThrow();
  });
  it('rejects unsafe JSON and oversized input',()=>{
    expect(()=>convertSafeYaml('json-to-yaml','{"n":9007199254740993}')).toThrow();
    expect(()=>convertSafeYaml('yaml-to-json',' '.repeat(2*1024**2+1))).toThrow();
  });
});
