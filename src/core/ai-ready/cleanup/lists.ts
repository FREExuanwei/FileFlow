import type { CleanupStats } from '../types';
export function normalizeLists(text:string,stats:CleanupStats):string {
  return text.replace(/^( *)([-*+]|\d+[.)])[ \t]+/gm,(original,indent:string,marker:string)=> {const prefix=`${indent}${/^\d/.test(marker)?marker.replace(/\)$/,' .').replace(' .','.'):'-'} `;if(prefix!==original)stats.listsNormalized++;return prefix;});
}
