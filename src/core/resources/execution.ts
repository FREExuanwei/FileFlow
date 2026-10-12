import type { ReleaseHandle } from './budget';
export class ExecutionGate {
  private running=new Map<string,boolean>();private listeners=new Set<()=>void>();private scheduled=false;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  canAcquire(heavy:boolean):boolean{return this.running.size<2&&(!heavy||![...this.running.values()].some(Boolean));}
  tryAcquire(owner:string,heavy:boolean):ReleaseHandle|undefined {
    if(this.running.has(owner)||!this.canAcquire(heavy))return;
    this.running.set(owner,heavy);let live=true;
    return {release:()=>{if(!live)return;live=false;this.running.delete(owner);if(!this.scheduled){this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;this.listeners.forEach(l=>l());});}}};
  }
}
