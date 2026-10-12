import type { ExtractedDocument, ExtractedPage, Preset, RepeatedCandidate, AiSettings, CleanupStats } from '../types';
const normalize = (text: string) => text.replace(/\s+/g,' ').trim();
const edge = (page: ExtractedPage, index: number, kind: 'header' | 'footer') => {
  const line=page.lines[index]; if (!line || !page.height || line.y === undefined || line.headingLevel) return false;
  const ratio=line.y/page.height; return kind==='header' ? ratio>=.9 : ratio<=.1;
};
export function detectRepeatedEdges(document: ExtractedDocument, preset: Preset): RepeatedCandidate[] {
  if (document.sourceFormat!=='pdf') return [];
  const pages=document.pages.filter(p=>!p.blank), groups=new Map<string,RepeatedCandidate>();
  for (const page of pages) for (const kind of ['header','footer'] as const) {
    const indices=kind==='header' ? page.lines.slice(0,3).map((_,i)=>i) : page.lines.slice(-3).map((_,i)=>Math.max(0,page.lines.length-3)+i);
    for (const index of indices) {
      const line=page.lines[index]!, text=normalize(line.text); if (!text || /^(?:Page\s+)?[-–]?\s*\d+\s*[-–]?$/i.test(text)) continue;
      const key=`${kind}:${text}`;
      let group=groups.get(key);
      if (!group) { let hash=2166136261;for (const char of key) hash=Math.imul(hash^char.charCodeAt(0),16777619); group={id:`${kind}-${hash>>>0}`,kind,text,occurrences:[],confidence:'high',eligible:false,removed:false};groups.set(key,group); }
      group.occurrences.push({page:page.number,line:index});
      const body=page.lines.filter((_,i)=>!edge(page,i,'header')&&!edge(page,i,'footer'));
      const sizes=body.map(l=>l.fontSize??10).sort((a,b)=>a-b), bodySize=sizes[Math.floor(sizes.length/2)]??10;
      const gap=Math.min(...body.map(l=>Math.abs((l.y??line.y??0)-(line.y??0))));
      if (!edge(page,index,kind)||!body.length||gap<bodySize*1.5||/^\s*(?:#|[-*+]\s|\d+[.)]\s|>|```|~~~|\$\$)|[|=∑∫±×÷]/.test(text)||body.some(l=>normalize(l.text)===text)) group.confidence='ambiguous';
    }
  }
  return [...groups.values()].filter(c=>new Set(c.occurrences.map(o=>o.page)).size>=2).map(c=> {
    if(pages.some(page=>page.lines.some((line,index)=>!edge(page,index,'header')&&!edge(page,index,'footer')&&normalize(line.text)===c.text)))c.confidence='ambiguous';
    const ratios=c.occurrences.map(o=>{const p=pages.find(p=>p.number===o.page)!;return (p.lines[o.line]!.y??-1000)/(p.height??1);});
    if (Math.max(...ratios)-Math.min(...ratios)>.02) c.confidence='ambiguous';
    c.eligible=new Set(c.occurrences.map(o=>o.page)).size>=3 && new Set(c.occurrences.map(o=>o.page)).size/pages.length >= (preset==='conservative'?.9:preset==='balanced'?.75:.6);
    return c;
  });
}
export function cleanPageEdges(document: ExtractedDocument, settings: AiSettings, stats: CleanupStats): {texts:string[];candidates:RepeatedCandidate[]} {
  const candidates=detectRepeatedEdges(document,settings.preset), removals=new Map<number,Set<number>>();
  const remove=(page:number,line:number) => {if(!removals.has(page))removals.set(page,new Set());removals.get(page)!.add(line);};
  for(const candidate of candidates) {
    const enabled=candidate.kind==='header'?settings.cleanup.removeHeaders:settings.cleanup.removeFooters;
    const override=settings.cleanup.candidateOverrides[candidate.id];
    const plausible= candidate.occurrences.every(o=>{const page=document.pages.find(p=>p.number===o.page)!;return edge(page,o.line,candidate.kind);});
    candidate.removed=enabled && override!=='keep' && (override==='remove' || candidate.eligible && (candidate.confidence==='high'||settings.preset==='aggressive'&&plausible));
    if(candidate.removed) for(const occurrence of candidate.occurrences) {remove(occurrence.page,occurrence.line); if(candidate.kind==='header')stats.headersRemoved++;else stats.footersRemoved++;}
  }
  if(document.sourceFormat==='pdf'&&settings.cleanup.removePageNumbers) {
    const numbers=document.pages.flatMap(page=>page.lines.flatMap((line,index)=> {
      const match=/^(?:Page\s+)?[-–]?\s*(\d+)\s*[-–]?$/i.exec(line.text.trim());
      const otherLines=page.lines.filter((_,i)=>i!==index),body=otherLines.filter(l=>l.y!==undefined&&page.height&&l.y/page.height>.1&&l.y/page.height<.9),sizes=body.map(l=>l.fontSize??10).sort((a,b)=>a-b),bodySize=sizes[Math.floor(sizes.length/2)]??10;
      const separated=body.length>0&&otherLines.every(l=>l.y!==undefined&&line.y!==undefined&&Math.abs(l.y-line.y)>=bodySize*1.5);
      return match&&(edge(page,index,'header')||edge(page,index,'footer'))&&(settings.preset==='aggressive'||separated) ? [{page:page.number,line:index,value:Number(match[1])}] : [];
    }));
    const offsets=new Map<number,typeof numbers>();
    for(const item of numbers) {const offset=item.value-item.page;if(!offsets.has(offset))offsets.set(offset,[]);offsets.get(offset)!.push(item);}
    for(const group of offsets.values()) if(new Set(group.map(o=>o.page)).size>=3) for(const item of group) {remove(item.page,item.line);stats.pageNumbersRemoved++;}
  }
  const texts=document.pages.map(page=> {
    let text=page.markdown;
    const ranges=[...(removals.get(page.number)??[])].map(index=>{const l=page.lines[index]!;return {start:l.start,end:l.end+(text[l.end]==='\n'?1:0)};}).sort((a,b)=>b.start-a.start);
    for(const range of ranges) text=text.slice(0,range.start)+text.slice(range.end);
    return text;
  });
  return {texts,candidates};
}
