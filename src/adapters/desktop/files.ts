import type {ResourceBudget} from '../../core/resources/budget';
export interface NativeGrant {id:string;name:string;size:number}
export interface DesktopBridge {
 pick(accept?:string,multiple?:boolean):Promise<NativeGrant[]>;
 read(id:string,offset:number,length:number):Promise<ArrayBuffer>;
 release(id:string):Promise<void>;
 chooseSave(name:string,size:number):Promise<NativeGrant|undefined>;
 write(id:string,offset:number,bytes:Uint8Array):Promise<void>;
 commit(id:string):Promise<void>;
 abort(id:string):Promise<void>;
}
const CHUNK=1024**2;
export class DesktopFiles {
 constructor(private bridge:DesktopBridge,private budget:ResourceBudget){}
 async importPicked(admit:(files:readonly File[])=>Promise<unknown>|void,accept?:string,multiple=true){await this.importGrants(await this.bridge.pick(accept,multiple),admit);}
 async importGrants(grants:NativeGrant[],admit:(files:readonly File[])=>Promise<unknown>|void){
  try{
   if(grants.length>50)throw Error('resource-limit');
   for(const grant of grants){
    const limit=/\.(pdf|png|jpe?g|webp)$/i.test(grant.name)?100:40;
    if(!grant.id||!grant.name||/[\\/:\0]/.test(grant.name)||!Number.isSafeInteger(grant.size)||grant.size<0||grant.size>limit*CHUNK)throw Error('invalid-grant');
    const usage=this.budget.getUsage();if(usage.tasks>=50||usage.sourceBytes+grant.size>200*CHUNK)throw Error('resource-limit');
    // Account retained chunks, possible File constructor copy, and both IPC endpoints.
    const lease=this.budget.reserve('transient',grant.size*2+CHUNK*2,'desktop-import');
    try{
     const parts:ArrayBuffer[]=[];
     for(let offset=0;offset<grant.size;offset+=CHUNK){const count=Math.min(CHUNK,grant.size-offset),bytes=await this.bridge.read(grant.id,offset,count);if(bytes.byteLength!==count)throw Error('read-failed');parts.push(bytes);}
     await admit([new File(parts,grant.name)]);
    }finally{lease.release();}
   }
  }finally{await Promise.allSettled(grants.map(g=>this.bridge.release(g.id)));}
 }
 async exportBlob(blob:Blob,name:string,signal?:AbortSignal){
  if(signal?.aborted)return false;
  const lease=this.budget.reserve('transient',CHUNK*2,'desktop-export');let committed=false,grant:NativeGrant|undefined;
  try{
   grant=await this.bridge.chooseSave(name,blob.size);if(!grant)return false;
   for(let offset=0;offset<blob.size;offset+=CHUNK){if(signal?.aborted)throw Error('cancelled');const bytes=new Uint8Array(await blob.slice(offset,offset+CHUNK).arrayBuffer());await this.bridge.write(grant.id,offset,bytes);}
   if(signal?.aborted)throw Error('cancelled');await this.bridge.commit(grant.id);committed=true;return true;
  }finally{lease.release();if(grant&&!committed)await this.bridge.abort(grant.id).catch(()=>{});}
 }
}
