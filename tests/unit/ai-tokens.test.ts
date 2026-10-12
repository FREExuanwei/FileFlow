import { expect, it } from 'vitest';
import { estimateTokens, estimatedChange, measureDocument } from '../../src/core/ai-ready/tokens';
it('estimate_is_deterministic_for_all_scripts',()=> {
  for(const text of ['', 'English example 123.', '中文虚构文档。','中英文 Mixed 2026','```js\nconst a=1;\n```','😀é','虚构 sentence. '.repeat(50000)]) {const n=estimateTokens(text);expect(n).toBe(estimateTokens(text));expect(Number.isInteger(n)&&n>=0).toBe(true);}
  expect(estimateTokens(' \n\t')).toBe(0);
  expect(measureDocument('# Heading\n\n中文\n\nEnglish words.')).toMatchObject({headings:1,paragraphs:2});
});
it('estimate_change_is_honest',()=> {
  expect(estimatedChange(100,120)).toEqual({direction:'increase',percent:20});
  expect(estimatedChange(100,75)).toEqual({direction:'decrease',percent:25});
  expect(estimatedChange(0,20)).toEqual({direction:'increase'});
  expect(estimatedChange(0,0)).toEqual({direction:'same',percent:0});
});
