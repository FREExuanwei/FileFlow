import {PDFDocument,PDFName,PDFArray,PDFDict,PDFRef,PDFStream,PDFObject,degrees,ParseSpeeds} from 'pdf-lib';
import {safeOutputName} from '../files/names';
import {parsePages,planOperation,validatePdfInput} from './plan';
import {PDF_TOOLS_LIMITS,type PdfRequest,type PdfResponse,type PdfInfo} from './types';
const dropped=['Annots','OpenAction','AA','AcroForm','Outlines','Names','EmbeddedFiles','AF','EF','JS','JavaScript','Launch','RichMedia','Metadata'];
// This tool outputs static pages. Remove interactive objects and discard unreachable
// copied objects, rather than leaving removed annotation bodies in the output file.
function staticPages(pdf:PDFDocument):void{
 const live=new Set<PDFRef>(),seen=new Set<PDFObject>(),pending:PDFObject[]=[];
 if(pdf.context.trailerInfo.Root)pending.push(pdf.context.trailerInfo.Root);
 if(pdf.context.trailerInfo.Info)pending.push(pdf.context.trailerInfo.Info);
 while(pending.length){const object=pending.pop()!;if(seen.has(object))continue;seen.add(object);
  if(object instanceof PDFRef){live.add(object);const child=pdf.context.lookup(object);if(child)pending.push(child);}
  else if(object instanceof PDFDict){dropped.forEach(key=>object.delete(PDFName.of(key)));pending.push(...object.values());}
  else if(object instanceof PDFArray)pending.push(...object.asArray());
  else if(object instanceof PDFStream)pending.push(object.dict);
 }
 for(const [ref] of pdf.context.enumerateIndirectObjects())if(!live.has(ref))pdf.context.delete(ref);
}
export async function executePdf(request:PdfRequest,progress:(value:number)=>void=()=>{},signal?:AbortSignal):Promise<PdfResponse>{
 const check=()=>{if(signal?.aborted)throw new Error('pdf_cancelled');};
 try{
  check();if(!request.inputs.length||request.inputs.length>50)throw new Error('pdf_invalid');
  request.inputs.forEach(validatePdfInput);
  if(request.inputs.reduce((sum,input)=>sum+input.size,0)>PDF_TOOLS_LIMITS.totalBytes)throw new Error('pdf_total_limit');
  const documents:PDFDocument[]=[],info:PdfInfo[]=[];let total=0;
  for(const input of request.inputs){
   check();const header=new TextDecoder().decode(await input.blob.slice(0,1024).arrayBuffer());if(!header.includes('%PDF-'))throw new Error('pdf_invalid');
   const bytes=await input.blob.arrayBuffer();check();
   const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,parseSpeed:ParseSpeeds.Slow,throwOnInvalidObject:true,updateMetadata:false});check();
   const count=pdf.getPageCount();total+=count;
   if(!count||total>PDF_TOOLS_LIMITS.pages||pdf.context.enumerateIndirectObjects().length>100000)throw new Error('pdf_page_limit');
   const pages=pdf.getPages().map(page=>{const {width,height}=page.getSize(),rotation=page.getRotation().angle,crop=page.getCropBox();
    if(![width,height,crop.width,crop.height].every(value=>Number.isFinite(value)&&value>0&&value<=20000)||![crop.x,crop.y,rotation].every(Number.isFinite)||rotation%90!==0)throw new Error('pdf_page_invalid');
    return {width,height,rotation};});
   info.push({pages,annotations:pdf.getPages().some(page=>page.node.has(PDFName.of('Annots')))||pdf.catalog.has(PDFName.of('AcroForm'))});documents.push(pdf);progress(Math.round(documents.length/request.inputs.length*30));
  }
  if(request.kind==='inspect')return{info,outputs:[]};
  if(request.kind!=='write'||(request.settings.operation==='merge'?documents.length<2:documents.length!==1))throw new Error('pdf_selection');
  const plans=planOperation(total,request.settings),rotate=request.settings.operation==='rotate'?new Set(parsePages(request.settings.selection,total)):new Set<number>();
  // Source documents exist only in this isolated operation; input Blobs remain untouched.
  documents.forEach(pdf=>pdf.getPages().forEach(page=>{page.node.delete(PDFName.of('Annots'));page.node.delete(PDFName.of('AA'));}));
  const outputs:PdfResponse['outputs']=[];let outputBytes=0;
  for(const [part,plan] of plans.entries()){
   check();const target=await PDFDocument.create({updateMetadata:false});
   if(request.settings.operation==='merge'){
    for(const source of documents){check();const copied=await target.copyPages(source,source.getPageIndices());copied.forEach(page=>target.addPage(page));}
   }else{
    const copied=await target.copyPages(documents[0]!,plan.map(page=>page-1));copied.forEach((page,index)=>{if(rotate.has(plan[index]!))page.setRotation(degrees((page.getRotation().angle+request.settings.rotation)%360));target.addPage(page);});
   }
   staticPages(target);check();const bytes=await target.save({useObjectStreams:true,addDefaultPage:false,objectsPerTick:100,updateFieldAppearances:false});check();outputBytes+=bytes.length;
   if(outputBytes>PDF_TOOLS_LIMITS.resultBytes)throw new Error('pdf_result_limit');
   const stem=safeOutputName(request.inputs[0]!.name,'pdf').replace(/\.pdf$/,'');
   const suffix=request.settings.operation==='split'?`part-${String(part+1).padStart(2,'0')}`:request.settings.operation;
   outputs.push({name:safeOutputName(`${stem}_${suffix}.pdf`,'pdf'),blob:new Blob([Uint8Array.from(bytes)],{type:'application/pdf'}),pages:target.getPageCount()});progress(30+Math.round((part+1)/plans.length*70));
  }
  return{info,outputs};
 }catch(error){if(error instanceof Error&&error.message.startsWith('pdf_'))throw error;if(error instanceof Error&&error.message.startsWith('Input document to `PDFDocument.load` is encrypted.'))throw new Error('pdf_encrypted',{cause:error});throw new Error('pdf_invalid',{cause:error});}
}
