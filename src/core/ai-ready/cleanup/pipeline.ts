import { validateSettings } from '../defaults';
import { checkText } from '../limits';
import { parseBlocks } from '../structure';
import type { AiSettings, CleanupResult, CleanupStats, ExtractedDocument } from '../types';
import { cleanPageEdges } from './pages';
import { normalizeWhitespace } from './whitespace';
import { mergeBrokenLines } from './lines';
import { normalizeHeading } from './headings';
import { normalizeLists } from './lists';
export class DocumentCleanupPipeline {
  static run(document:ExtractedDocument,settings:AiSettings):CleanupResult {
    validateSettings(settings);
    const stats:CleanupStats={headersRemoved:0,footersRemoved:0,pageNumbersRemoved:0,linesMerged:0,blankLinesRemoved:0,headingsNormalized:0,listsNormalized:0};
    const edges=cleanPageEdges(document,settings,stats);
    const texts=edges.texts.map(source=> {
      checkText(source);const text=source.replace(/\r\n?/g,'\n');
      return parseBlocks(text).map(block=> {
        let content=text.slice(block.start,block.end);
        if(block.protected||['code','math','table','quote','separator'].includes(block.kind))return content;
        content=normalizeWhitespace(content,settings.cleanup.collapseBlankLines,stats,block.kind==='blank');
        if(block.kind==='heading'&&settings.cleanup.normalizeHeadings) content=normalizeHeading(content,block,stats);
        if(block.kind==='list'&&settings.cleanup.normalizeLists)content=normalizeLists(content,stats);
        if(block.kind==='paragraph'&&settings.cleanup.mergeLines)content=mergeBrokenLines(content,stats,settings.preset==='aggressive');
        return content;
      }).join('');
    });
    const markdown=texts.join(document.sourceFormat==='pdf'?'\n\n---\n\n':'');checkText(markdown);
    return {markdown,stats,candidates:edges.candidates,warnings:settings.preset==='aggressive'?[{code:'aggressive-cleanup'}]:[]};
  }
}
