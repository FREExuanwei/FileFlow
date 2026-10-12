import type { Block, OutlineEntry } from './types';
/** Source intervals cover every code unit. Keep offsets, never one regex match object per line. */
export function parseBlocks(markdown: string): Block[] {
  if (!markdown.length) return [];
  const starts=[0];
  for(const match of markdown.matchAll(/\r\n|\r|\n/g)){const next=match.index!+match[0].length;if(next<markdown.length)starts.push(next);}
  const lineAt=(index:number)=>markdown.slice(starts[index]!,starts[index+1]??markdown.length).replace(/[\r\n]+$/,'');
  const setext=(line:string)=>/^ {0,3}(=+|-+)\s*$/.exec(line);
  const fenceAt=(line:string)=>/^[ \t]*(`{3,}|~{3,})/.exec(line);
  const consumeFence=(opening:string,index:number)=>{const closing=new RegExp(`^[ \\t]*${opening[0]}{${opening.length},}\\s*$`);while(index<starts.length){if(closing.test(lineAt(index++)))break;}return index;};
  const blocks:Block[]=[];let i=0;
  while(i<starts.length){
    const begin=i,line=lineAt(i),trimmed=line.trim();
    let kind:Block['kind']='paragraph',level:number|undefined,title:string|undefined,protectedContent=false;
    const fence=/^ {0,3}(`{3,}|~{3,})/.exec(line),heading=/^ {0,3}(#{1,6})[ \t]+(.*)$/.exec(line);
    if(fence){kind='code';i=consumeFence(fence[1]!,i+1);}
    else if(/^\s*(?:\$\$|\\\[)/.test(line)){
      kind='math';i++;const bracket=/^\s*\\\[/.test(line),inline=bracket?/^\s*\\\[.*\\\]\s*$/.test(line):/^\s*\$\$.+\$\$\s*$/.test(line);
      if(!inline)while(i<starts.length){if((bracket?/^\s*\\\]\s*$/:/^\s*\$\$\s*$/).test(lineAt(i++)))break;}
    }else if(heading){kind='heading';level=heading[1]!.length;title=heading[2]!.replace(/[ \t]+#+[ \t]*$/,'').trim();if(/^#+$/.test(title))title='';i++;}
    else if(trimmed&&i+1<starts.length&&setext(lineAt(i+1))&&!/^[-*+]\s/.test(line)){kind='heading';level=lineAt(i+1).trimStart()[0]==='='?1:2;title=trimmed;i+=2;}
    else{
      if(!trimmed)kind='blank';
      else if(/^(?: {4}|\t)/.test(line))kind='code';
      else if(/^ {0,3}(?:[-*+]\s|\d+[.)]\s)/.test(line))kind='list';
      else if(/^ {0,3}>/.test(line))kind='quote';
      else if(/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line))kind='separator';
      else if(line.includes('|')&&i+1<starts.length&&/^\s*\|?\s*:?-{3,}/.test(lineAt(i+1)))kind='table';
      i++;
      const initialListFence=kind==='list'?fenceAt(line.replace(/^ {0,3}(?:[-*+]|\d+[.)])[ \t]+/,'')):null;
      if(initialListFence){protectedContent=true;i=consumeFence(initialListFence[1]!,i);}
      while(i<starts.length){
        const next=lineAt(i);
        if(kind==='list'&&/^(?: {2,}|\t)/.test(next)){
          const nestedFence=fenceAt(next);
          if(nestedFence){protectedContent=true;i=consumeFence(nestedFence[1]!,i+1);continue;}
          if(/^(?: {4}|\t)/.test(next))protectedContent=true;
        }
        if(kind==='code'&&!next.trim()){
          let after=i+1;while(after<starts.length&&!lineAt(after).trim())after++;
          if(after<starts.length&&/^(?: {4}|\t)/.test(lineAt(after))){i=after;continue;}break;
        }
        const continues=kind==='blank'?!next.trim():kind==='code'?/^(?: {4}|\t)/.test(next):kind==='table'?!!next.trim()&&next.includes('|'):kind==='list'?/^ {0,3}(?:[-*+]\s|\d+[.)]\s)|^(?: {2,}|\t)\S/.test(next):kind==='quote'?/^ {0,3}>/.test(next):kind==='paragraph'?!!next.trim()&&!/^ {0,3}(?:#{1,6}\s|`{3,}|~{3,}|[-*+]\s|\d+[.)]\s|>|\$\$|\\\[|[-=_]{3,})|^(?: {4}|\t)/.test(next):false;
        if(!continues)break;
        if(kind==='paragraph'&&i+1<starts.length&&setext(lineAt(i+1))){kind='heading';level=lineAt(i+1).trimStart()[0]==='='?1:2;title=Array.from({length:i-begin+1},(_,offset)=>lineAt(begin+offset).trim()).join(' ');i+=2;break;}
        i++;
      }
    }
    blocks.push({kind,start:starts[begin]!,end:starts[i]??markdown.length,...(level?{level,title}:{}),...(protectedContent?{protected:true as const}:{})});
  }
  return blocks;
}
export function buildOutline(_markdown:string,blocks:readonly Block[]):OutlineEntry[]{return blocks.filter(b=>b.kind==='heading').map((b,i)=>({id:`heading-${i+1}`,start:b.start,end:b.end,level:b.level!,title:b.title!}));}
