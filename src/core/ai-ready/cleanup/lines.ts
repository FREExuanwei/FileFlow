import type { CleanupStats } from '../types';
export function mergeBrokenLines(text:string, stats:CleanupStats, aggressive:boolean):string {
  const lines=text.split('\n');let output=lines[0]??'';
  for(let i=1;i<lines.length;i++) {
    const previous=lines[i-1]!,next=lines[i]!;
    const safe=previous.trim()&&next.trim()&&!/[.!?。！？:：;；]\s*$| {2}$|\\$/.test(previous)&&!/[=∑∫±×÷$]/.test(previous+next)&&!/^\s*\d+$/.test(previous)&&!/^\s*\d+$/.test(next)&&!/^\s*(?:[-*+]\s|\d+[.)]\s|#|>|\|)/.test(next);
    if(safe&&(aggressive||previous.trim().length>=4)) {const separator=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(previous.trimEnd())&&/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(next.trimStart())?'':' ';output=output.trimEnd()+separator+next.trimStart();stats.linesMerged++;}
    else output+='\n'+next;
  }
  return output;
}
