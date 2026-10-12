import type { ExportFile } from '../../core/ai-ready/types';
import { ResourceBudget,type MemoryLease } from '../../core/resources/budget';
import type { WebFileOutputAdapter } from './files';
export type DownloadState={phase:'idle'|'requesting'|'requests-sent'|'stopped'|'error';requestsSent:number;error?:'download-request-failed'};
export class AiDownloadController {
  private generation=0;private active=false;private held=new Map<MemoryLease,ReturnType<typeof setTimeout>>();
  constructor(private options:{output:Pick<WebFileOutputAdapter,'save'|'dispose'>;budget:ResourceBudget;onChange:(state:DownloadState)=>void}){}
  private submit(file:ExportFile){
    const lease=this.options.budget.reserve('result',file.estimatedTransientBytes,'ai-export');
    try{const text=file.readText(),blob=new Blob([text],{type:file.mime});if(blob.size+text.length*2>file.estimatedTransientBytes)throw new Error('export-size');this.options.output.save(blob,file.name);
      this.held.set(lease,setTimeout(()=>{lease.release();this.held.delete(lease);},1000));
    }catch(error){lease.release();throw error;}
  }
  saveOne(file:ExportFile):void{try{this.submit(file);}catch{this.options.onChange({phase:'error',requestsSent:0,error:'download-request-failed'});}}
  async start(files:readonly ExportFile[],valid:()=>boolean):Promise<void>{
    if(this.active)return;this.active=true;const generation=++this.generation;let requestsSent=0;
    this.options.onChange({phase:'requesting',requestsSent});
    try{for(const file of [...files]){if(generation!==this.generation)return;if(!valid()){this.options.onChange({phase:'stopped',requestsSent});return;}this.submit(file);requestsSent++;this.options.onChange({phase:'requesting',requestsSent});await new Promise(r=>setTimeout(r,300));}
      if(generation===this.generation)this.options.onChange({phase:'requests-sent',requestsSent});
    }catch{if(generation===this.generation)this.options.onChange({phase:'error',requestsSent,error:'download-request-failed'});}
    finally{if(generation===this.generation)this.active=false;}
  }
  stop(){this.generation++;this.active=false;this.options.onChange({phase:'stopped',requestsSent:0});}
  dispose(){this.stop();for(const [lease,timer]of this.held){clearTimeout(timer);lease.release();}this.held.clear();this.options.output.dispose();}
}
