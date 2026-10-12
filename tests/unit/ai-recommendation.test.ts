import {expect,it} from 'vitest';
import {recommendDocument,AUTO_CHUNK_THRESHOLD} from '../../src/core/ai-ready/recommendation';
import {analyzeDocument} from '../../src/core/ai-ready/analysis';
import {settingsForPreset} from '../../src/core/ai-ready/defaults';
const document={sourceFormat:'md' as const,pages:[{number:1,markdown:'# Fictional\n\nClean fictional content.',lines:[],blank:false}],warnings:[]};
const result=()=>analyzeDocument(document,settingsForPreset('balanced'));
it('four_recommendations_are_deterministic_from_existing_data',()=>{
  const clean=result();clean.before.estimatedTokens=8000;clean.after.estimatedTokens=8000;
  expect(recommendDocument(clean).kind).toBe('none');expect(recommendDocument(clean)).toEqual(recommendDocument(structuredClone(clean)));
  clean.cleaned.stats.headersRemoved=3;expect(recommendDocument(clean).kind).toBe('clean');
  clean.after.estimatedTokens=AUTO_CHUNK_THRESHOLD+1;expect(recommendDocument(clean).kind).toBe('clean-and-chunk');
  clean.cleaned.stats.headersRemoved=0;expect(recommendDocument(clean).kind).toBe('chunk');
});
it('tiny_changes_and_few_page_numbers_do_not_claim_cleanup_benefit',()=>{
  const clean=result();clean.before.estimatedTokens=8000;clean.after.estimatedTokens=7997;Object.assign(clean.cleaned.stats,{pageNumbersRemoved:3,blankLinesRemoved:2,headingsNormalized:1,listsNormalized:1});
  expect(recommendDocument(clean).kind).toBe('none');expect(recommendDocument(clean).alreadyClean).toBe(true);
  clean.after.estimatedTokens=8005;expect(recommendDocument(clean).kind).toBe('none');
});
it('meaningful_broken_line_cleanup_and_reduction_are_recognized',()=>{
  const clean=result();clean.before.estimatedTokens=8000;clean.after.estimatedTokens=8000;clean.cleaned.stats.linesMerged=30;
  expect(recommendDocument(clean).kind).toBe('clean');
  clean.cleaned.stats.linesMerged=2;clean.after.estimatedTokens=7700;expect(recommendDocument(clean).kind).toBe('clean');
});
it('ambiguous_edges_do_not_justify_cleaning_and_incomplete_pages_stay_reviewable',()=>{
  const clean=result();clean.cleaned.candidates=[{id:'header-1',kind:'header',text:'Fictional',occurrences:[],confidence:'ambiguous',eligible:true,removed:false}];
  expect(recommendDocument(clean).kind).toBe('none');
  clean.cleaned.candidates[0]!.confidence='high';expect(recommendDocument(clean).kind).toBe('none');
  clean.extracted.warnings=[{code:'blank-pages',count:1}];expect(recommendDocument(clean).alreadyClean).toBe(false);
});
it('auto_is_default_and_keeps_medium_clean_document_whole',()=>{
  const text=Array.from({length:8},(_,i)=>`# Fictional section ${i}\n\n${'clean fictional words '.repeat(140)}\n\n`).join('');
  const source={...document,pages:[{...document.pages[0]!,markdown:text}]},settings=settingsForPreset('balanced');
  expect(settings.chunking.strategy).toBe('auto');const analyzed=analyzeDocument(source,settings);
  expect(analyzed.after.estimatedTokens).toBeGreaterThan(4000);expect(analyzed.after.estimatedTokens).toBeLessThanOrEqual(AUTO_CHUNK_THRESHOLD);expect(analyzed.chunks).toHaveLength(1);
  expect(analyzed.chunks[0]!.primary).toEqual({start:0,end:analyzed.cleaned.markdown.length});expect(analyzed.chunks[0]!.warnings).toEqual([]);expect(recommendDocument(analyzed).kind).toBe('none');
});
it('explicit_heading_token_size_and_overlap_remain_available',()=>{
  const text='# Fictional\n\n'+('Clean fictional sentence.\n\n'.repeat(1500)),source={...document,pages:[{...document.pages[0]!,markdown:text}]},settings=settingsForPreset('balanced');
  settings.chunking.strategy='tokens';settings.chunking.targetEstimatedTokens=4000;settings.chunking.overlapPercent=10;
  const analyzed=analyzeDocument(source,settings);expect(analyzed.chunks.length).toBeGreaterThan(1);expect(analyzed.chunks.some(c=>c.overlap)).toBe(true);expect(analyzed.chunks.map(c=>analyzed.cleaned.markdown.slice(c.primary.start,c.primary.end)).join('')).toBe(analyzed.cleaned.markdown);
});
it('auto_only_chunks_above_threshold_and_ignores_hidden_overlap',()=>{
  const source={...document,pages:[{...document.pages[0]!,markdown:'Fictional sentence.\n\n'.repeat(8000)}]},settings=settingsForPreset('balanced');settings.chunking.overlapPercent=10;
  const analyzed=analyzeDocument(source,settings);expect(analyzed.after.estimatedTokens).toBeGreaterThan(AUTO_CHUNK_THRESHOLD);expect(analyzed.chunks.length).toBeGreaterThan(1);expect(analyzed.chunks.every(c=>!c.overlap)).toBe(true);
});
