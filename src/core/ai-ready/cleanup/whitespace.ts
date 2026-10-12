import type { CleanupStats } from '../types';
export function normalizeWhitespace(text:string, collapse:boolean, stats:CleanupStats, blank=false):string {
  if(blank) {if(!collapse)return text;const count=(text.match(/\n/g)??[]).length;stats.blankLinesRemoved+=Math.max(0,count-1);return count?'\n':text;}
  return text.replace(/\t/g,' ').split('\n').map(line=>line.endsWith('  ')?line.replace(/ +$/,'  '):line.replace(/[ \t]+$/,'')).join('\n');
}
