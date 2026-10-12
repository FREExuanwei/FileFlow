import type {ConversionQueue} from '../queue/store';
import type {QueueItem} from '../queue/types';
import type {Phase5Queue} from './queue';
import type {P5Job,P5Input,P5Operation,P5Format} from './types';
import {activeCatalog,recommendedRoute,type Admission} from './catalog';
import {newFormatName,detectP5Format} from './detect';
import {transferReady} from './transfer';
import {P5Error} from './errors';
export type WorkspaceRow=({owner:'legacy';job:QueueItem}|{owner:'phase5';job:P5Job})&{workspaceId:string;localId:string;ordinal:number;name:string;size:number;format?:P5Format};
export interface WorkspaceView{items:readonly WorkspaceRow[];activeId?:string;noticeCode?:string;legacyNotice?:string}
type Metadata={workspaceId:string;ordinal:number;name:string;size:number;format?:P5Format};
export class WorkspaceCoordinator{
  private snapshot:WorkspaceView={items:[]};private metadata=new Map<string,Metadata>();private listeners=new Set<()=>void>();private ordinal=0;private unsub:(()=>void)[]=[];private transaction=false;private activeId?:string;
  constructor(readonly legacy:ConversionQueue,readonly phase5:Phase5Queue,readonly admission:Admission,active=true){if(active)this.activate();else this.update();}
  activate=()=>{this.unsub.forEach(fn=>fn());this.unsub=[this.legacy.subscribe(this.update),this.phase5.subscribe(this.update)];this.update();};
  private update=()=>{
    if(this.transaction)return;const rows:WorkspaceRow[]=[],live=new Set<string>();
    for(const owner of ['legacy','phase5'] as const){const jobs=owner==='legacy'?this.legacy.getSnapshot().items:this.phase5.getSnapshot().items;for(const job of jobs){const key=`${owner}:${job.id}`;live.add(key);let meta=this.metadata.get(key);if(!meta){const input=job.input,legacy=owner==='legacy'?job as QueueItem:undefined;const format=legacy?.format??(job as P5Job).format??newFormatName(input?.name??'')??(input?.name.toLowerCase().endsWith('.json')?'json':input?.name.toLowerCase().endsWith('.csv')?'csv':undefined);meta={workspaceId:`workspace-${++this.ordinal}`,ordinal:this.ordinal,name:legacy?.name??input?.name??'File',size:legacy?.size??input?.size??0,format};this.metadata.set(key,meta);}const format=owner==='legacy'?(job as QueueItem).format:meta.format;rows.push(owner==='legacy'?{...meta,format,localId:job.id,owner,job:job as QueueItem}:{...meta,localId:job.id,owner,job:job as P5Job});}}
    for(const key of this.metadata.keys())if(!live.has(key))this.metadata.delete(key);rows.sort((a,b)=>a.ordinal-b.ordinal);
    // Collision names are assigned in workspace order, independent of owner and completion order.
    const used=new Set<string>();const named=rows.map(row=>{const result=row.job.result;if(!result||'kind'in result&&result.kind!=='file')return row;const original=result.name;let name=original,n=1;const dot=original.lastIndexOf('.'),base=dot<0?original:original.slice(0,dot),ext=dot<0?'':original.slice(dot);while(used.has(name.toLowerCase()))name=`${base.slice(0,110)} (${n++})${ext}`;used.add(name.toLowerCase());if(name===original)return row;return row.owner==='legacy'?{...row,job:{...row.job,result:{...row.job.result!,name}}}:{...row,job:{...row.job,result:{...result,name}}} as WorkspaceRow;});
    if(!named.some(r=>r.workspaceId===this.activeId))this.activeId=named[0]?.workspaceId;this.snapshot={items:named,activeId:this.activeId,noticeCode:this.phase5.getSnapshot().noticeCode,legacyNotice:this.legacy.getSnapshot().notice};this.listeners.forEach(fn=>fn());
  };
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private row(id:string){return this.snapshot.items.find(r=>r.workspaceId===id);}
  async add(files:readonly P5Input[]){
    // Both queues reserve synchronously before awaiting validation; no unaccounted import backlog.
    const pending:Promise<unknown>[]=[];
    for(const input of files){const format=newFormatName(input.name);if(format){const route=recommendedRoute(format,this.admission);if(!route)throw new P5Error('type');pending.push(this.phase5.add(input,{kind:'route',routeId:route.id}).then(async id=>{try{await detectP5Format(input);}catch(error){this.phase5.remove(id);throw error;}}));}else pending.push(this.legacy.add([input]));}
    const outcomes=await Promise.allSettled(pending);const failed=outcomes.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  }
  async addUtility(input:P5Input,operation:Exclude<P5Operation,{kind:'route'}>){return this.phase5.add(input,operation);}
  configure(id:string,operation:P5Operation){
    const row=this.row(id);if(!row)return;const route=operation.kind==='route'?activeCatalog(this.admission).find(r=>r.id===operation.routeId):undefined;if(operation.kind==='route'&&(!route||route.input!==row.format))throw new P5Error('type');
    const owner=route?.owner??'phase5';if(row.owner===owner){if(row.owner==='legacy'&&route&&route.converter.input===row.format){this.legacy.configure(row.localId,{target:(route.converter as import('../conversion/types').Converter).output});}else this.phase5.configure(row.localId,operation);return;}
    const from=row.owner==='legacy'?this.legacy.stageReadyTransfer(row.localId):this.phase5.stageReadyTransfer(row.localId);if(!from)throw new P5Error('input');const to=owner==='legacy'&&route?this.legacy.stageReadyReceive(from.value,(route.converter as import('../conversion/types').Converter).output):this.phase5.stageReadyReceive(from.value,operation);if(!to)throw new P5Error('input');
    const meta=this.metadata.get(`${row.owner}:${row.localId}`)!;this.transaction=true;try{if(!transferReady(from,to))throw new P5Error('stale');const target=owner==='legacy'?this.legacy.getSnapshot().items.find(j=>j.input===from.value.input):this.phase5.getSnapshot().items.find(j=>j.input===from.value.input);if(!target)throw new P5Error('structure');this.metadata.delete(`${row.owner}:${row.localId}`);this.metadata.set(`${owner}:${target.id}`,meta);this.activeId=id;}finally{this.transaction=false;this.update();}
  }
  select=(id:string)=>{const row=this.row(id);if(!row)return;this.activeId=id;(row.owner==='legacy'?this.legacy:this.phase5).select(row.localId);};
  start=(id:string)=>{const row=this.row(id);if(row)(row.owner==='legacy'?this.legacy:this.phase5).start(row.localId);};
  startAll=()=>{this.legacy.startAll();this.phase5.startAll();};
  cancel=(id:string)=>{const row=this.row(id);if(row)(row.owner==='legacy'?this.legacy:this.phase5).cancel(row.localId);};
  remove=(id:string)=>{const row=this.row(id);if(row)(row.owner==='legacy'?this.legacy:this.phase5).remove(row.localId);};
  clear=()=>{this.legacy.clear();this.phase5.clear();};
  clearCompleted=()=>{this.legacy.clearCompleted();this.phase5.clearCompleted();};
  dispose=()=>{this.unsub.forEach(fn=>fn());this.unsub=[];this.listeners.clear();};
}
