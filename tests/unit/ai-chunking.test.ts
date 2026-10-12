import { expect, it } from 'vitest';
import { chunkDocument, chunkMarkdown, primaryMarkdown } from '../../src/core/ai-ready/chunking';
import {estimateTokens} from '../../src/core/ai-ready/tokens';
it('nested_fenced_list_is_indivisible_even_above_target',()=>{
  const source='- Example:\n  ```text\n  '+('fictional '.repeat(5000))+'\n  - code line\n  ```\n';
  const chunks=chunkDocument(source,{strategy:'tokens',targetEstimatedTokens:2000,overlapPercent:0});
  expect(chunks).toHaveLength(1);expect(primaryMarkdown(source,chunks[0]!)).toBe(source);expect(chunks[0]!.warnings.map(w=>w.code)).toContain('oversized-block');
});
it('zero_overlap_roundtrip_is_exact',()=> {
  const source='# Intro\n\nFictional sentence. '.repeat(100)+'\n\n## 中文\n\n'+('这是虚构文字，完整的句子。\n\n'.repeat(1000))+'\n```js\n  code();\n```\n';
  for(const strategy of ['headings','tokens'] as const)for(const targetEstimatedTokens of [2000,4000,8000,16000] as const){const chunks=chunkDocument(source,{strategy,targetEstimatedTokens,overlapPercent:0});expect(chunks.map(c=>primaryMarkdown(source,c)).join('')).toBe(source);expect(chunks.map(c=>chunkMarkdown(source,c)).join('')).toBe(source);}
  expect(chunkDocument('Small document.',{strategy:'headings',targetEstimatedTokens:4000,overlapPercent:0})).toHaveLength(1);
  expect(()=>chunkDocument('  \n',{strategy:'tokens',targetEstimatedTokens:4000,overlapPercent:0})).toThrow('no-content');
});
it('oversized_code_or_sentence_is_kept_and_warned',()=> {
  for(const source of ['```\n'+'x'.repeat(40000)+'\n```\n','中文'.repeat(5000)]) {const chunks=chunkDocument(source,{strategy:'tokens',targetEstimatedTokens:2000,overlapPercent:0});expect(chunks).toHaveLength(1);expect(chunks[0]?.warnings.map(w=>w.code)).toContain('oversized-block');expect(primaryMarkdown(source,chunks[0]!)).toBe(source);}
});
it('overlap_is_bounded_and_deduplicable',()=> {
  const source='# Guide\n\n'+('Fictional paragraph contains several words.\n\n'.repeat(3000));
  for(const overlapPercent of [0,5,10] as const){const chunks=chunkDocument(source,{strategy:'headings',targetEstimatedTokens:2000,overlapPercent});expect(chunks.map(c=>primaryMarkdown(source,c)).join('')).toBe(source);for(const [index,chunk]of chunks.entries()){if(chunk.overlap){expect(chunk.overlap.end).toBe(chunk.primary.start);expect(chunk.overlap.start).toBeGreaterThanOrEqual(chunks[index-1]!.primary.start);expect(estimateTokens(source.slice(chunk.overlap.start,chunk.overlap.end))).toBeLessThanOrEqual(2000*overlapPercent/100);}expect(chunk.estimatedTokens).toBe(estimateTokens(chunkMarkdown(source,chunk)));}}
});
it('long_section_split_at_paragraphs_is_reported',()=>{
  const source='# Fictional section\n\n'+('Fictional paragraph with a complete sentence.\n\n'.repeat(1000));const chunks=chunkDocument(source,{strategy:'headings',targetEstimatedTokens:2000,overlapPercent:0});expect(chunks.length).toBeGreaterThan(1);expect(chunks[0]!.warnings.map(w=>w.code)).toContain('section-split');expect(chunks.map(c=>primaryMarkdown(source,c)).join('')).toBe(source);
});
