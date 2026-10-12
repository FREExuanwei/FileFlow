import { parseBlocks } from './structure';
import type { DocumentStats } from './types';
export const TOKEN_ESTIMATE_VERSION='unicode-heuristic-v1';
export function estimateTokens(text:string):number {
  let tokens=0;
  for(const match of text.matchAll(/[A-Za-z]+|[0-9]+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}]+|[^\s]/gu)) {
    const run=match[0];
    if(/^[A-Za-z]/.test(run))tokens+=Math.ceil(run.length/4);
    else if(/^[0-9]/.test(run))tokens+=Math.ceil(run.length/3);
    else if(/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(run))tokens+=1.5;
    else if(/^\p{L}/u.test(run))tokens+=Math.ceil(Array.from(run).length/3);
    else if(!/^\p{M}/u.test(run))tokens++;
  }
  return Math.ceil(tokens);
}
export function measureDocument(text:string):DocumentStats {
  const blocks=parseBlocks(text);
  return {characters:Array.from(text).length,whitespaceDelimitedWords:(text.match(/[^\s]+/gu)??[]).filter(word=>/[\p{L}\p{N}]/u.test(word)).length,estimatedTokens:estimateTokens(text),headings:blocks.filter(b=>b.kind==='heading').length,paragraphs:blocks.filter(b=>b.kind==='paragraph').length};
}
export function estimatedChange(before:number,after:number):{direction:'increase'|'decrease'|'same';percent?:number} {
  const direction=after>before?'increase':after<before?'decrease':'same';
  return {direction,...(before>0?{percent:Math.abs(after-before)/before*100}:after===0?{percent:0}:{})};
}
