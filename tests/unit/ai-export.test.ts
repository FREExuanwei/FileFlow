import { expect, it } from 'vitest';
import { buildAiExport } from '../../src/core/ai-ready/export';
import { DocumentCleanupPipeline } from '../../src/core/ai-ready/cleanup/pipeline';
import { settingsForPreset } from '../../src/core/ai-ready/defaults';
import { measureDocument } from '../../src/core/ai-ready/tokens';
import { parseBlocks, buildOutline } from '../../src/core/ai-ready/structure';
import { chunkDocument } from '../../src/core/ai-ready/chunking';
import { safeOutputName } from '../../src/core/files/names';
import MarkdownIt from 'markdown-it';
const settings=settingsForPreset('balanced'),source='# Fictional guide\n\n'+('虚构段落与 English sentence.\n\n'.repeat(2000));
const extracted={sourceFormat:'md' as const,pages:[{number:1,markdown:source,lines:[],blank:false}],warnings:[]};
const cleaned=DocumentCleanupPipeline.run(extracted,settings),result={extracted,cleaned,before:measureDocument(source),after:measureDocument(cleaned.markdown),outline:buildOutline(cleaned.markdown,parseBlocks(cleaned.markdown)),chunks:chunkDocument(cleaned.markdown,{...settings.chunking,strategy:'headings'})};
it('long_unicode_names_never_break_index_generation',()=>{
  for(const name of ['😀'.repeat(60)+'.md','a'+'😀'.repeat(60)+'.md']){
    const files=buildAiExport(result,name,settings),index=files.find(f=>f.kind==='index')!.readText();
    for(const file of files.filter(f=>f.kind==='chunk')){expect(file.name).not.toMatch(/[\uD800-\uDFFF]/u);expect(index).toContain(encodeURIComponent(file.name));}
  }
});
it('index_links_roundtrip_markdown_destination_delimiters',()=>{
  const files=buildAiExport(result,'Report).md',settings),index=files.find(f=>f.kind==='index')!.readText();
  const links=new MarkdownIt().parse(index,{}).flatMap(token=>token.children??[]).filter(token=>token.type==='link_open').map(token=>decodeURIComponent(String(token.attrGet('href'))));
  expect(links).toEqual(files.filter(f=>f.kind==='chunk').map(f=>f.name));
});
it('exports_all_parts_index_metadata_and_unicode',()=> {
  for(const name of ['虚构文档.md','CON.md','C:\\private\\safe.md','a'.repeat(120)+'.md']){
    const files=buildAiExport(result,name,settings,1);
    expect(files.map(f=>f.name)).toEqual(files.map(f=>safeOutputName(f.name,f.name.split('.').at(-1)!)));
    expect(files.find(f=>f.kind==='clean')!.readText()).toBe(cleaned.markdown);
    expect(files.filter(f=>f.kind==='chunk').map(f=>f.readText()).join('')).toBe(cleaned.markdown);
    const index=files.find(f=>f.kind==='index')!.readText();
    expect(index).toContain('Estimated tokens');
    const links=new MarkdownIt().parse(index,{}).flatMap(token=>token.children??[]).filter(token=>token.type==='link_open').map(token=>decodeURIComponent(String(token.attrGet('href'))));
    expect(links).toEqual(files.filter(f=>f.kind==='chunk').map(f=>f.name));
  }
});
it('metadata_contains_only_allowlisted_fields',()=> {
  const metadata=buildAiExport(result,'C:\\Users\\fictional\\demo.md',settings).find(f=>f.kind==='metadata')!.readText();
  expect(metadata).not.toContain('C:');expect(metadata).not.toContain('Users');
  expect(JSON.parse(metadata)).toMatchObject({source:{basename:'demo.md',format:'md'},tokenEstimate:{exact:false,algorithm:'unicode-heuristic-v1'}});
  expect(metadata).not.toContain('English sentence');
});
