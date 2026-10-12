import { parseBlocks, buildOutline } from './structure';
import { estimateTokens } from './tokens';
import { CHUNK_LIMIT, checkText } from './limits';
import { AiError, type AiChunk, type ChunkOptions, type Block } from './types';
export function primaryMarkdown(markdown:string,chunk:AiChunk):string { return markdown.slice(chunk.primary.start,chunk.primary.end); }
export function chunkMarkdown(markdown:string,chunk:AiChunk):string { return markdown.slice(chunk.overlap?.start??chunk.primary.start,chunk.primary.end); }
export function chunkDocument(markdown:string,options:ChunkOptions):AiChunk[] {
  checkText(markdown);if(!markdown.trim())throw new AiError('no-content');
  const blocks=parseBlocks(markdown),outline=buildOutline(markdown,blocks),target=options.targetEstimatedTokens;
  if(![2000,4000,8000,16000].includes(target)||![0,5,10].includes(options.overlapPercent)||!['headings','tokens'].includes(options.strategy))throw new AiError('invalid-settings');
  const atoms: (Block & {tokens:number;split?:boolean})[]=[];
  for(const block of blocks) {
    const text=markdown.slice(block.start,block.end),tokens=estimateTokens(text);
    if(block.protected||tokens<=target||!['paragraph','list'].includes(block.kind)) {atoms.push({...block,tokens});continue;}
    const matches=block.kind==='paragraph'?[...text.matchAll(/[^.!?。！？]+[.!?。！？]+(?:[ \t]+|\n+)?|[^.!?。！？]+$/gu)]:[...text.matchAll(/(?:^|\n)(?= {0,3}(?:[-*+]\s|\d+[.)]\s))/g)];
    const ends=block.kind==='paragraph'?matches.map(m=>m.index!+m[0].length):matches.slice(1).map(m=>m.index!+1);
    if(ends.at(-1)!==text.length)ends.push(text.length);
    let start=0;for(const end of ends)if(end>start) {atoms.push({kind:block.kind,start:block.start+start,end:block.start+end,tokens:estimateTokens(text.slice(start,end)),split:true});start=end;}
  }
  const chunks:AiChunk[]=[];let begin=0,total=0,hasBody=false;
  const flush=(end:number)=> {
    if(end<=begin)return;
    if(chunks.length>=CHUNK_LIMIT)throw new AiError('chunk-limit');
    const ordinal=chunks.length+1,id=`part-${String(ordinal).padStart(3,'0')}`;
    const primary={start:atoms[begin]!.start,end:atoms[end-1]!.end};
    const chunk:AiChunk={id,ordinal,primary,estimatedTokens:estimateTokens(markdown.slice(primary.start,primary.end)),outlineIds:outline.filter(h=>h.start>=primary.start&&h.start<primary.end).map(h=>h.id),warnings:[]};
    const nextContent=atoms.slice(end).find(a=>!['blank','separator'].includes(a.kind));
    if(atoms.slice(begin,end).some(a=>a.split)||nextContent&&nextContent.kind!=='heading'&&outline.some(h=>h.start<primary.end))chunk.warnings.push({code:'section-split',chunkId:id});
    if(chunk.estimatedTokens>target)chunk.warnings.push({code:'oversized-block',chunkId:id});
    if(options.overlapPercent&&chunks.length) {
      const previous=chunks.at(-1)!,budget=Math.floor(target*options.overlapPercent/100);let count=0,first=begin;
      for(let i=begin-1;i>=0&&atoms[i]!.start>=previous.primary.start;i--) {if(count+atoms[i]!.tokens>budget)break;count+=atoms[i]!.tokens;first=i;}
      if(first<begin&&count>0)chunk.overlap={start:atoms[first]!.start,end:primary.start};else chunk.warnings.push({code:'overlap-shortfall',chunkId:id});
      chunk.estimatedTokens=estimateTokens(chunkMarkdown(markdown,chunk));
    }
    chunks.push(chunk);begin=end;total=0;hasBody=false;
  };
  const bodyTarget=Math.max(1,Math.floor(target*(1-options.overlapPercent/100)));
  for(let i=0;i<atoms.length;i++) {
    const atom=atoms[i]!;
    if(i>begin&&hasBody&&(total+atom.tokens>bodyTarget||options.strategy==='headings'&&atom.kind==='heading'&&total>=bodyTarget*.5))flush(i);
    // Do not strand a heading from its first body block even when that block exceeds target.
    total+=atom.tokens;if(!['heading','blank','separator'].includes(atom.kind))hasBody=true;
  }
  flush(atoms.length);return chunks;
}
