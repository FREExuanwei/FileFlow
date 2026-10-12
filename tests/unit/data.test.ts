import { describe, expect, it } from 'vitest';
import { convertData } from '../../src/converters/data/transform';

describe('CSV and JSON', () => {
  it('preserves UTF-8 quoted commas, quotes and multiline values', () => {
    expect(JSON.parse(convertData('csv-to-json', '\ufeffname,note\r\n虚构,"hello, ""world""\nnext"'))).toEqual([{ name: '虚构', note: 'hello, "world"\nnext' }]);
  });
  it('exports union columns without losing later keys', () => {
    expect(convertData('json-to-csv', '[{"a":1},{"b":true}]')).toBe('a,b\r\n1,\r\n,true');
  });
  it('rejects invalid JSON, nested values and non-object arrays', () => {
    expect(() => convertData('json-to-csv', '{bad}')).toThrow('Invalid JSON');
    expect(() => convertData('json-to-csv', '[{"a":{"b":1}}]')).toThrow('nested');
    expect(() => convertData('json-to-csv', '[1]')).toThrow('flat objects');
    expect(() => convertData('json-to-csv', '[]')).toThrow('empty');
  });
  it('rejects malformed quotes, row mismatch and duplicate/blank headers', () => {
    for (const csv of ['a,b\n"broken,1', 'a,b\n1,2,3', 'a,a\n1,2', ',b\n1,2']) {
      expect(() => convertData('csv-to-json', csv)).toThrow('CSV');
    }
  });
  it('escapes spreadsheet formula values and headers', () => {
    const csv = convertData('json-to-csv', '[{"=cmd":"=SUM(1)","safe":"@evil"}]');
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'=SUM(1)");
    expect(csv).toContain("'@evil");
    expect(convertData('json-to-csv', '[{"note":"  =SUM(1)"}]')).toContain("'  =SUM(1)");
  });
  it('rejects sparse JSON that would expand to too many cells', () => {
    const rows = Array.from({ length: 1100 }, (_, i) => ({ [`column${i % 950}`]: i }));
    expect(() => convertData('json-to-csv', JSON.stringify(rows))).toThrow('output');
  });
  it('rejects CSV headers that would amplify output beyond the memory cap', () => {
    const csv = 'x'.repeat(10000) + '\n' + Array.from({ length: 4000 }, () => '1').join('\n');
    expect(() => convertData('csv-to-json', csv)).toThrow('output');
  });
  it('safely preserves special property names', () => {
    expect(JSON.parse(convertData('csv-to-json', '__proto__,constructor\nfictional,value'))).toEqual([{ __proto__: null, constructor: 'value' }].map(() => JSON.parse('{"__proto__":"fictional","constructor":"value"}')));
  });
});
