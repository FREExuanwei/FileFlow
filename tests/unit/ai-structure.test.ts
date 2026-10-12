import { describe, expect, it } from 'vitest';
import { settingsForPreset, validateSettings } from '../../src/core/ai-ready/defaults';
import { buildOutline, parseBlocks } from '../../src/core/ai-ready/structure';

describe('AI document contracts', () => {
  it('heading_literal_hashes_survive_outline', () => {
    const source='## C#\n# foo#\n# Closed ###\n';
    expect(buildOutline(source,parseBlocks(source)).map(h=>h.title)).toEqual(['C#','foo#','Closed']);
  });
  it('multiline_setext_keeps_complete_heading_scope',()=>{
    const source='one\ntwo\n---\n';
    expect(buildOutline(source,parseBlocks(source))).toEqual([{id:'heading-1',start:0,end:source.length,level:2,title:'one two'}]);
  });
  it('defaults_are_balanced_auto_zero', () => {
    expect(settingsForPreset('balanced')).toMatchObject({ preset: 'balanced', chunking: { strategy: 'auto', targetEstimatedTokens: 4000, overlapPercent: 0 } });
    expect(settingsForPreset('conservative').cleanup.mergeLines).toBe(false);
    expect(() => validateSettings({ ...settingsForPreset('balanced'), chunking: { strategy: 'tokens', targetEstimatedTokens: 3, overlapPercent: 10 } } as never)).toThrow();
  });
  it('blocks_partition_source_without_loss', () => {
    const source = '# Same\r\n\r\nText.\r\n\r\n~~~js\r\n# not heading\r\n  x\r\n~~~\r\n\r\nSame\r\n====\r\n\r\n- one\r\n- two\r\n\r\n| A | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\n\r\n$$\r\nx = 2\r\n$$\r\n\r\n    code\r\n\r\n> quote\r\n';
    const blocks = parseBlocks(source);
    expect(blocks.map(b => source.slice(b.start, b.end)).join('')).toBe(source);
    expect(['heading', 'code', 'table', 'math', 'list', 'quote'].every(k => blocks.some(b => b.kind === k))).toBe(true);
    const outline = buildOutline(source, blocks);
    expect(outline.map(h => h.title)).toEqual(['Same', 'Same']);
    expect(new Set(outline.map(h => h.id)).size).toBe(2);
  });
  it('unclosed_fence_protects_the_remainder', () => {
    const source = '```\n# not a heading\ntext';
    expect(parseBlocks(source)).toEqual([{ kind: 'code', start: 0, end: source.length }]);
    expect(buildOutline(source, parseBlocks(source))).toEqual([]);
  });
});
