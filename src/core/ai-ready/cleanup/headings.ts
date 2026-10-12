import type { Block, CleanupStats } from '../types';
export function normalizeHeading(text:string, block:Block, stats:CleanupStats):string {
  const normalized=`${'#'.repeat(block.level!)} ${block.title!}${text.endsWith('\n')?'\n':''}`;
  if(normalized!==text)stats.headingsNormalized++;return normalized;
}
