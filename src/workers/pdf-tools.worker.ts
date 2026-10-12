import {executePdf} from '../core/pdf-tools/engine';
import type {PdfRequest} from '../core/pdf-tools/types';
self.onmessage=async(event:MessageEvent<PdfRequest>)=>{
 try{const result=await executePdf(event.data,value=>self.postMessage({kind:'progress',value}));self.postMessage({kind:'result',result});}
 catch(error){self.postMessage({kind:'error',error:error instanceof Error&&error.message.startsWith('pdf_')?error.message:'pdf_invalid'});}
};
