export interface ReleaseHandle { release():void }
export interface MemoryLease extends ReleaseHandle { resize(bytes:number):void }
export class ResourceBudget {
  private usage={tasks:0,sourceBytes:0,resultBytes:0,transientBytes:0};private listeners=new Set<()=>void>();private scheduled=false;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getUsage=()=>({tasks:this.usage.tasks,sourceBytes:this.usage.sourceBytes,resultBytes:this.usage.resultBytes});
  getTransientUsage=()=>this.usage.transientBytes;
  private notify(){if(this.scheduled)return;this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;this.listeners.forEach(l=>l());});}
  reserveTask(owner:string):ReleaseHandle {void owner;if(this.usage.tasks>=50)throw new Error('resource-limit');this.usage.tasks++;let live=true;return {release:()=>{if(live){live=false;this.usage.tasks--;this.notify();}}};}
  reserve(kind:'source'|'result'|'transient',bytes:number,owner:string):MemoryLease {
    void owner;
    const key=kind==='source'?'sourceBytes':kind==='transient'?'transientBytes':'resultBytes',limit=(kind==='source'?200:kind==='transient'?256:128)*1024**2;
    let held=0,live=true;
    const resize=(size:number)=>{if(!live||!Number.isSafeInteger(size)||size<0||this.usage[key]-held+size>limit)throw new Error('resource-limit');const delta=size-held;this.usage[key]+=delta;held=size;if(delta<0)this.notify();};
    resize(bytes);return {resize,release:()=>{if(live){this.usage[key]-=held;held=0;live=false;this.notify();}}};
  }
}
