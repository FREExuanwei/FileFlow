import { expect, it } from 'vitest';
import { settingsForPreset } from '../../src/core/ai-ready/defaults';
import { DocumentCleanupPipeline } from '../../src/core/ai-ready/cleanup/pipeline';
import type { ExtractedDocument } from '../../src/core/ai-ready/types';
const doc = (text: string): ExtractedDocument => ({sourceFormat:'md',pages:[{number:1,markdown:text,lines:[],blank:false}],warnings:[]});
const pdf = (edgeY = 800): ExtractedDocument => ({sourceFormat:'pdf',warnings:[],pages:[1,2,3,4].map(number => {
  const rows = ['Fictional Guide',`Unique body ${number}.`,'Fictional Footer',`Page ${number}`]; let cursor=0;
  return {number,height:842,blank:false,markdown:rows.join('\n'),lines:rows.map((text,i) => {const start=cursor;cursor+=text.length+1;return {text,start,end:cursor-1,y:[edgeY,700,40,20][i],fontSize:10};})};
})});
it('literal_heading_hashes_and_nested_fenced_code_are_preserved',()=>{
  const source='## C#\n\n- Example:\n  ```python\n  \tprint("a")  \n  * literal\n\n  - code line\n  ```\n';
  for(const preset of ['conservative','balanced','aggressive'] as const)expect(DocumentCleanupPipeline.run(doc(source),settingsForPreset(preset)).markdown).toBe(source);
});
it('multiline_indented_code_and_bracket_math_keep_internal_blank_lines',()=>{
  for(const source of ['    first  \n\n\n    second\n','\\[\n  x =  2\n\n\n  y =  3\n\\]\n','- ```python\n  \tprint("a")  \n  * literal\n  ```\n'])for(const preset of ['conservative','balanced','aggressive'] as const)expect(DocumentCleanupPipeline.run(doc(source),settingsForPreset(preset)).markdown).toBe(source);
  expect(DocumentCleanupPipeline.run(doc('one\ntwo\n---\n'),settingsForPreset('balanced')).markdown).toBe('## one two\n');
});
it('edge_text_seen_in_any_page_body_is_ambiguous',()=>{
  const source=pdf();
  const page=source.pages[3]!; const rows=['Other title','Body start','Middle start','Fictional Guide','Middle end','Body end','Other footer'];let cursor=0;
  page.height=842;page.markdown=rows.join('\n');page.lines=rows.map((text,index)=>{const start=cursor;cursor+=text.length+1;return{text,start,end:cursor-1,y:[800,710,680,600,550,400,40][index],fontSize:10};});
  for(const preset of ['conservative','balanced'] as const){const result=DocumentCleanupPipeline.run(source,settingsForPreset(preset));expect(result.stats.headersRemoved).toBe(0);expect(result.candidates.find(c=>c.text==='Fictional Guide')?.confidence).toBe('ambiguous');}
});
it('short_pages_without_non_edge_body_keep_numeric_content',()=>{
  const source=pdf();source.pages=source.pages.slice(0,3).map(page=>({...page,height:800,markdown:`Fictional Guide\n${page.number}`,lines:[{text:'Fictional Guide',start:0,end:15,y:760,fontSize:10},{text:String(page.number),start:16,end:17,y:60,fontSize:10}]}));
  for(const preset of ['conservative','balanced'] as const){const result=DocumentCleanupPipeline.run(source,settingsForPreset(preset));expect(result.stats.pageNumbersRemoved).toBe(0);expect(result.markdown).toContain('\n3');}
});
it('high_confidence_pdf_edges_are_removed_per_page', () => {
  const settings=settingsForPreset('balanced'), result=DocumentCleanupPipeline.run(pdf(),settings);
  expect(result.stats).toMatchObject({headersRemoved:4,footersRemoved:4,pageNumbersRemoved:4});
  expect(result.markdown).not.toContain('Fictional Guide');
  expect(result.markdown).toContain('Unique body 4.');
  const candidate=result.candidates.find(c=>c.kind==='header')!;
  settings.cleanup.candidateOverrides[candidate.id]='keep';
  expect(DocumentCleanupPipeline.run(pdf(),settings).stats.headersRemoved).toBe(0);
});
it('conservative_and_balanced_keep_ambiguous_body', () => {
  for (const preset of ['conservative','balanced'] as const) {
    const settings=settingsForPreset(preset);
    expect(DocumentCleanupPipeline.run(pdf(740),settings).markdown).toContain('Fictional Guide');
    const source=pdf(); source.pages.forEach(p=> {delete p.height;});
    expect(DocumentCleanupPipeline.run(source,settings).stats.headersRemoved).toBe(0);
    const short=pdf();short.pages=short.pages.slice(0,2);
    expect(DocumentCleanupPipeline.run(short,settings).stats.headersRemoved).toBe(0);
    expect(DocumentCleanupPipeline.run(doc('12\n\n2026\n\n# Chapter\n'),settings).markdown).toContain('12');
    const headings=pdf();headings.pages.forEach(p=>{p.lines[0]!.headingLevel=2;});
    expect(DocumentCleanupPipeline.run(headings,settings).stats.headersRemoved).toBe(0);
  }
});
it('page_edge_numbers_close_to_body_are_kept',()=>{
  const source=pdf();for(const page of source.pages){page.lines[2]!.text=`Fictional body ${page.number}`;page.markdown=page.lines.map(l=>l.text).join('\n');let cursor=0;page.lines.forEach((line,i)=>{line.start=cursor;line.end=cursor+line.text.length;cursor=line.end+1;if(i===2)line.y=70;if(i===3)line.y=60;});}
  for(const preset of ['conservative','balanced'] as const){const result=DocumentCleanupPipeline.run(source,settingsForPreset(preset));expect(result.stats.pageNumbersRemoved).toBe(0);expect(result.markdown).toContain('Page 4');}
});
it('english_chinese_merge_preserves_boundaries', () => {
  const result=DocumentCleanupPipeline.run(doc('# Title\n\nThis is a very long\nsentence across lines.\n\n人工智能已经成为\n计算机科学的重要方向。\n\n- one\n- two\n'),settingsForPreset('balanced'));
  expect(result.markdown).toContain('This is a very long sentence across lines.');
  expect(result.markdown).toContain('人工智能已经成为计算机科学的重要方向。');
  expect(result.stats.linesMerged).toBe(2);
  expect(result.markdown).toContain('- one\n- two');
});
it('whitespace_does_not_change_code_math_tables', () => {
  const protectedText='```js\n  a  \n\t b\n```\n\n$$\nx =  2\n$$\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
  const result=DocumentCleanupPipeline.run(doc(protectedText),settingsForPreset('balanced'));
  expect(result.markdown).toBe(protectedText);
  expect(DocumentCleanupPipeline.run(doc('a  \nb\n'),settingsForPreset('balanced')).markdown).toBe('a  \nb\n');
});
it('disabled_rules_have_zero_counts_and_conservative_keeps_lines', () => {
  const settings=settingsForPreset('conservative');
  expect(DocumentCleanupPipeline.run(doc('a\nb\n'),settings).stats.linesMerged).toBe(0);
  settings.cleanup.collapseBlankLines=false;
  expect(DocumentCleanupPipeline.run(doc('a\n\n\n\nb'),settings).stats.blankLinesRemoved).toBe(0);
});
it('normalization_counts_actual_changes_and_aggressive_warns', () => {
  const result=DocumentCleanupPipeline.run(doc('Title\n====\n\n\n\n*    item\n'),settingsForPreset('aggressive'));
  expect(result.markdown).toContain('# Title');
  expect(result.stats.headingsNormalized).toBe(1);
  expect(result.stats.blankLinesRemoved).toBe(2);
  expect(result.markdown).toContain('- item');
  expect(result.warnings.map(w=>w.code)).toContain('aggressive-cleanup');
});
