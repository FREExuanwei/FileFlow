import { safeOutputName } from '../files/names';
import { aiSourceName,aiExportBase } from './names';
import { chunkMarkdown } from './chunking';
import { TOKEN_ESTIMATE_VERSION } from './tokens';
import type { AiResult, AiSettings, ExportFile } from './types';
const escape=(text:string)=>text.replace(/[\\`*_[\]<>#]/g,'\\$&').replace(/[\r\n]+/g,' ');
const destination=(name:string)=>encodeURIComponent(name).replace(/[()]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
export function buildAiExport(result:AiResult,sourceName:string,settings:AiSettings,collisionOrdinal=0):ExportFile[] {
  const basename=aiSourceName(sourceName,result.extracted.sourceFormat);
  const stem=aiExportBase(sourceName)+(collisionOrdinal?` (${collisionOrdinal})`:'');
  const files:ExportFile[]=[];
  const add=(id:string,name:string,kind:ExportFile['kind'],maxUnits:number,readText:()=>string)=>files.push({id,name,kind,mime:kind==='metadata'?'application/json':'text/markdown;charset=utf-8',estimatedTransientBytes:Math.max(256,5*maxUnits),readText});
  add('clean',safeOutputName(`${stem}-clean.md`,'md'),'clean',result.cleaned.markdown.length,()=>result.cleaned.markdown);
  for(const chunk of result.chunks) {
    const name=safeOutputName(`${stem}-${chunk.id}.md`,'md');
    add(chunk.id,name,'chunk',chunk.primary.end-(chunk.overlap?.start??chunk.primary.start),()=>chunkMarkdown(result.cleaned.markdown,chunk));
  }
  const parts=files.filter(f=>f.kind==='chunk');
  const sections=(chunk:typeof result.chunks[number])=>chunk.outlineIds.map(id=>result.outline.find(h=>h.id===id)?.title??'').filter(Boolean);
  const index=()=>`# Document Index\n\nSource: ${escape(basename)}\n\nChunks: ${result.chunks.length}\n\n`+result.chunks.map((c,i)=>`## [Part ${String(c.ordinal).padStart(3,'0')}](${destination(parts[i]!.name)})\n\nEstimated tokens: ${c.estimatedTokens}\n\n${sections(c).map(title=>`- ${escape(title)}\n`).join('')}\n`).join('');
  const metadata=()=>JSON.stringify({schemaVersion:1,source:{basename,format:result.extracted.sourceFormat},cleaningSettings:settings,cleaningSummary:result.cleaned.stats,chunking:settings.chunking,tokenEstimate:{algorithm:TOKEN_ESTIMATE_VERSION,exact:false,beforeEstimatedTokens:result.before.estimatedTokens,afterEstimatedTokens:result.after.estimatedTokens},chunks:result.chunks.map(c=>({file:parts[c.ordinal-1]!.name,ordinal:c.ordinal,estimatedTokens:c.estimatedTokens,primary:c.primary,overlap:c.overlap,sections:sections(c)}))},null,2)+'\n';
  const outlineUnits=result.outline.reduce((sum,h)=>sum+h.title.length,0),maxMetadata=5000+result.chunks.length*1500+outlineUnits*6+Object.keys(settings.cleanup.candidateOverrides).length*100;
  add('index','index.md','index',maxMetadata,index);add('metadata','metadata.json','metadata',maxMetadata,metadata);
  return files;
}
