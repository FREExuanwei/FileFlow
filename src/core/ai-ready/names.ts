import { safeOutputName } from '../files/names';
/** Keep legacy filename sanitization, then repair only AI names at Unicode boundaries. */
export function aiSourceName(name:string,extension:string):string{return safeOutputName(name,extension).replace(/[\uD800-\uDFFF]/gu,'_');}
export function aiExportBase(name:string):string{
  const base=aiSourceName(name,'md').replace(/\.[^.]+$/,'');let stem='';
  for(const char of base){if(stem.length+char.length>95)break;stem+=char;}
  return stem;
}
