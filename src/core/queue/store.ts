import type { ConversionOptions, ConversionResult, Format, InputFile } from '../conversion/types';
import { convertFile } from '../conversion/service';
import { detectFormat } from '../files/detect';
import { safeOutputName } from '../files/names';
import { imageDimensions } from '../../converters/image/dimensions';
import { resizeDimensions } from '../../converters/image/resize';
import { recommendations } from './recommendations';
import { renameOutput } from './names';
import { isBusy, isFinished, isImage, type QueueItem, type QueueSnapshot } from './types';
import { ResourceBudget, type MemoryLease, type ReleaseHandle } from '../resources/budget';
import { ExecutionGate } from '../resources/execution';
import type {ReadyTransfer,ReadyTransferStage} from './transfer';
import {P5Error} from '../phase5/errors';
import {imageHeader} from '../files/policy';
let queueSerial = 0;

const extension = (format: Format) => format === 'jpeg' ? 'jpg' : format;
type Runner = (job: QueueItem, options: ConversionOptions) => Promise<ConversionResult>;
async function run(job: QueueItem, options: ConversionOptions) {
  // Allow the busy state to paint before synchronous markup parsing.
  if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  options.signal?.throwIfAborted();
  if (job.mode === 'image' && isImage(job.format) && isImage(job.target)) {
    const input = job.input!;
    if (await detectFormat(input) !== job.format) throw new Error('This conversion is not supported for the selected file.');
    const { convertImage } = await import('../../converters/image/convert');
    return { ...await convertImage(input.blob, job.format, job.target, options), name: '', format: job.target, warnings: [] };
  }
  return convertFile(job.input!, `${job.format}-to-${job.target}`, options);
}

/** Immutable snapshots. No persistent storage. Cancellation retains execution slots until settlement. */
export class ConversionQueue {
  private snapshot: QueueSnapshot = { items: [] };
  private listeners = new Set<() => void>();
  private running = new Map<string, { controller: AbortController; heavy: boolean; input: InputFile }>();
  private pendingInputs = new Map<string, InputFile>();
  private validatingInput?: InputFile;
  private serial = 0;
  private epoch = 0;
  private imports: Promise<void> = Promise.resolve();
  private runner: Runner;
  private budget: ResourceBudget; private execution: ExecutionGate; private prefix = `convert-${++queueSerial}`;
  private sourceLeases = new Map<InputFile, MemoryLease>(); private resultLeases = new Map<Blob, MemoryLease>(); private taskLeases = new Map<string, ReleaseHandle>(); private executionLeases = new Map<string, ReleaseHandle>(); private unsubscribe: (()=>void)[];
  constructor(dependencies: { run?: Runner; budget?: ResourceBudget; execution?: ExecutionGate } = {}) {
    this.runner = dependencies.run ?? run; this.budget = dependencies.budget ?? new ResourceBudget(); this.execution = dependencies.execution ?? new ExecutionGate();
    this.unsubscribe = [this.execution.subscribe(()=>this.pump())];
  }
  dispose = () => { this.clear(); this.unsubscribe.forEach(fn=>fn()); };
  activate = () => { this.unsubscribe.forEach(fn=>fn());this.unsubscribe=[this.execution.subscribe(()=>this.pump())]; };
  private reconcile() {
    const inputs = new Set<InputFile>([...this.snapshot.items.flatMap(i=>i.input?[i.input]:[]),...this.pendingInputs.values(),...[...this.running.values()].map(i=>i.input),...(this.validatingInput?[this.validatingInput]:[])]);
    for (const [input,lease] of this.sourceLeases) if(!inputs.has(input)){lease.release();this.sourceLeases.delete(input);}
    const results = new Set(this.snapshot.items.flatMap(i=>i.result?[i.result.blob]:[]));
    for(const [blob,lease] of this.resultLeases)if(!results.has(blob)){lease.release();this.resultLeases.delete(blob);}
    const ids = new Set([...this.snapshot.items.map(i=>i.id),...[...this.pendingInputs.keys()].filter(i=>!i.startsWith('restore-')),...this.running.keys()]);
    for(const [id,lease] of this.taskLeases)if(!ids.has(id)){lease.release();this.taskLeases.delete(id);}
  }
  getSnapshot = () => this.snapshot;
  /** Isolated Phase5 bridge: no allocations, async work or notifications before both commits. */
  stageReadyTransfer(id:string):ReadyTransferStage|undefined{
    const before=this.snapshot,job=before.items.find(i=>i.id===id);
    if(!job?.input||job.status!=='ready'||job.result||this.running.has(id)||!['csv','json'].includes(job.format??'')||before.items.filter(i=>i.input===job.input).length!==1||[...this.pendingInputs.values()].includes(job.input)||this.validatingInput===job.input)return;
    const input=job.input,taskLease=this.taskLeases.get(id),sourceLease=this.sourceLeases.get(input);if(!taskLease||!sourceLease)return;
    const value:ReadyTransfer={input,taskLease,sourceLease,basename:job.basename,format:job.format as 'csv'|'json'};let committed=false;
    return{value,commit:()=>{if(this.snapshot!==before||this.running.has(id))throw new P5Error('stale');this.taskLeases.delete(id);this.sourceLeases.delete(input);this.snapshot={...before,items:before.items.filter(i=>i.id!==id),activeId:before.activeId===id?before.items.find(i=>i.id!==id)?.id:before.activeId};committed=true;},rollback:()=>{if(committed){this.snapshot=before;this.taskLeases.set(id,taskLease);this.sourceLeases.set(input,sourceLease);committed=false;}},publish:()=>{if(committed)this.publish(this.snapshot.items);}};
  }
  stageReadyReceive(value:ReadyTransfer,target:Format):ReadyTransferStage|undefined{
    if(!['csv','json'].includes(value.format)||!recommendations(value.format).some(r=>r.output===target)||this.sourceLeases.has(value.input))return;
    const before=this.snapshot,id=`file-${++this.serial}`,job:QueueItem={id,input:value.input,name:value.input.name,size:value.input.size,type:value.input.type,format:value.format,target,basename:value.basename,mode:'convert',options:{quality:.85},status:'ready',progress:0};let committed=false;
    return{value,commit:()=>{if(this.snapshot!==before||this.sourceLeases.has(value.input))throw new P5Error('stale');this.taskLeases.set(id,value.taskLease);this.sourceLeases.set(value.input,value.sourceLease);this.snapshot={...before,items:[...before.items,job],activeId:id};committed=true;},rollback:()=>{if(committed){this.snapshot=before;this.taskLeases.delete(id);this.sourceLeases.delete(value.input);committed=false;}},publish:()=>{if(committed)this.publish(this.snapshot.items);}};
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(items: readonly QueueItem[], extra: Partial<QueueSnapshot> = {}) {
    // Recompute collision names in queue order, independently of completion order.
    const used = new Set<string>();
    const named = items.map(item => {
      if (!item.result) return item;
      const ext = extension(item.result.format), base = renameOutput(item.basename, ext);
      let name = base, n = 1;
      while (used.has(name.toLocaleLowerCase('en'))) { const suffix = ` (${n++})`; name = `${base.slice(0, -(ext.length + 1)).slice(0, 120 - suffix.length)}${suffix}.${ext}`; }
      used.add(name.toLocaleLowerCase('en'));
      return item.result.name === name ? item : { ...item, result: { ...item.result, name } };
    });
    this.snapshot = { ...this.snapshot, items: named, ...extra };
    this.reconcile();
    this.listeners.forEach(listener => listener());
  }
  private patch(id: string, update: Partial<QueueItem>) { this.publish(this.snapshot.items.map(item => item.id === id ? { ...item, ...update } : item)); }
  select = (id: string) => { if (this.snapshot.items.some(i => i.id === id)) this.publish(this.snapshot.items, { activeId: id }); };
  dismissNotice = () => this.publish(this.snapshot.items, { notice: undefined });
  private sourceBytes() {
    const retained = new Set<InputFile>([...this.snapshot.items.flatMap(i => i.input ? [i.input] : []), ...this.pendingInputs.values(), ...[...this.running.values()].map(i => i.input), ...(this.validatingInput ? [this.validatingInput] : [])]);
    return [...retained].reduce((sum, i) => sum + i.size, 0);
  }
  add(files: readonly InputFile[]): Promise<void> {
    const epoch = this.epoch;
    const ids: string[] = [];
    // Reserve before async work. Repeated drops cannot create an unbounded import backlog.
    for (const input of files) {
      const bytes = this.sourceBytes();
      if (this.snapshot.items.length + this.pendingInputs.size >= 50 || bytes + input.size > 200 * 1024 ** 2) {
        this.publish(this.snapshot.items, { notice: 'Queue limit reached: 50 files or 200 MB of source files. Remove files before adding more.' }); break;
      }
      const id = `file-${++this.serial}`;
      let task: ReleaseHandle | undefined;
      try { task=this.budget.reserveTask(`${this.prefix}-${id}`); if(!this.sourceLeases.has(input))this.sourceLeases.set(input,this.budget.reserve('source',input.size,`${this.prefix}-${id}`));this.taskLeases.set(id,task); }
      catch { task?.release(); this.publish(this.snapshot.items,{notice:'Queue limit reached: 50 files or 200 MB of source files. Remove files before adding more.'});break; }
      ids.push(id); this.pendingInputs.set(id, input);
    }
    const importNext = async () => {
      for (const id of ids) {
        if (epoch !== this.epoch) return;
        const input = this.pendingInputs.get(id); if (!input) continue;
        this.pendingInputs.delete(id); this.validatingInput = input;
        const item: QueueItem = { id, input, name: input.name, size: input.size, type: input.type, target: 'md', basename: 'converted', mode: 'convert', options: { quality: .85 }, status: 'validating', progress: 0 };
        this.publish([...this.snapshot.items, item], { activeId: this.snapshot.activeId ?? id });
        try {
          const format = await detectFormat(input), target = recommendations(format)[0]?.output;
          if (!target) throw new Error('This conversion is not supported for the selected file.');
          const sourceDimensions = isImage(format) ? imageDimensions(new Uint8Array(await imageHeader(input.blob)), format) : undefined;
          if (epoch !== this.epoch || !this.snapshot.items.some(i => i.id === id)) continue;
          this.patch(id, { format, target, sourceDimensions, basename: safeOutputName(input.name, extension(target)).replace(/\.[^.]+$/, ''), status: 'ready' });
        } catch (error) {
          if (epoch === this.epoch && this.snapshot.items.some(i => i.id === id)) this.patch(id, { status: 'failed', input: undefined, error: error instanceof Error ? error.message : 'Conversion failed. Try a smaller file or check its format.' });
        } finally { this.validatingInput = undefined; this.reconcile(); }
      }
    };
    this.imports = this.imports.then(importNext, importNext);
    return this.imports;
  }
  restore(id: string, source: InputFile): Promise<void> {
    const job = this.snapshot.items.find(i => i.id === id);
    if (!job || isBusy(job) || this.running.has(id)) return Promise.resolve();
    const key = `restore-${id}`, epoch = this.epoch;
    if (this.pendingInputs.has(key)) return Promise.resolve();
    if (this.pendingInputs.size >= 50 || this.sourceBytes() + source.size > 200 * 1024 ** 2) { this.publish(this.snapshot.items, { notice: 'Queue limit reached: 50 files or 200 MB of source files. Remove files before adding more.' }); return Promise.resolve(); }
    try {if(!this.sourceLeases.has(source))this.sourceLeases.set(source,this.budget.reserve('source',source.size,`${this.prefix}-${key}`));} catch {this.publish(this.snapshot.items,{notice:'Queue limit reached: 50 files or 200 MB of source files. Remove files before adding more.'});return Promise.resolve();}
    this.pendingInputs.set(key, source);
    const restoreSource = async () => {
      const input = this.pendingInputs.get(key); this.pendingInputs.delete(key);
      if (!input || epoch !== this.epoch || !this.snapshot.items.some(i => i.id === id)) { this.reconcile(); return; }
      this.validatingInput = input; this.patch(id, { status: 'validating', input, error: undefined });
      try {
        const format = await detectFormat(input);
        if (job.format && format !== job.format) throw new Error('Choose a source with the same format as this task.');
        const sourceDimensions = isImage(format) ? imageDimensions(new Uint8Array(await imageHeader(input.blob)), format) : undefined;
        if (epoch !== this.epoch || !this.snapshot.items.some(i => i.id === id)) return;
        const target = job.format ? job.target : recommendations(format)[0]?.output;
        if (!target) throw new Error('This conversion is not supported for the selected file.');
        const resize = sourceDimensions && job.options.resize ? { ...resizeDimensions(sourceDimensions.width, sourceDimensions.height, job.options.resize.width, job.options.resize.height, job.options.resize.keepAspect), keepAspect: job.options.resize.keepAspect } : undefined;
        this.patch(id, { name: input.name, size: input.size, type: input.type, format, target, sourceDimensions, result: undefined, ...(job.format ? {} : { basename: safeOutputName(input.name, extension(target)).replace(/\.[^.]+$/, ''), draftName: undefined }), options: { ...job.options, resize }, draftResize: undefined, status: 'ready', progress: 0 });
      } catch (error) {
        if (epoch === this.epoch && this.snapshot.items.some(i => i.id === id)) this.patch(id, { input: undefined, status: job.result ? job.status : 'failed', error: error instanceof Error ? error.message : 'Conversion failed. Try a smaller file or check its format.' });
      } finally { this.validatingInput = undefined; this.reconcile(); }
    };
    this.imports = this.imports.then(restoreSource, restoreSource); return this.imports;
  }
  configure(id: string, update: Partial<Pick<QueueItem, 'target' | 'mode' | 'options'>>) {
    const job = this.snapshot.items.find(i => i.id === id);
    if (!job?.input || isBusy(job) || !job.format) return;
    const mode = update.mode ?? job.mode, target = update.target ?? job.target;
    if (mode === 'image' ? !isImage(job.format) || !isImage(target) : !recommendations(job.format).some(i => i.output === target)) return;
    this.patch(id, { ...update, ...(update.mode === 'convert' ? { draftResize: undefined, issues: { ...job.issues, resize: undefined } } : {}), status: 'ready', error: undefined });
  }
  rename(id: string, basename: string) {
    const job = this.snapshot.items.find(i => i.id === id);
    if (!job || isBusy(job)) return;
    renameOutput(basename, extension(job.target)); this.patch(id, { basename: basename.trim() });
  }
  editName(id: string, value: string) {
    const job = this.snapshot.items.find(i => i.id === id); if (!job || isBusy(job)) return;
    try { renameOutput(value, extension(job.target)); this.patch(id, { draftName: value, basename: value.trim(), issues: { ...job.issues, name: undefined } }); }
    catch (error) { this.patch(id, { draftName: value, issues: { ...job.issues, name: error instanceof Error ? error.message : '' } }); }
  }
  editResize(id: string, width: string, height: string, keepAspect: boolean, axis: 'width' | 'height') {
    const job = this.snapshot.items.find(i => i.id === id); if (!job?.input || !job.sourceDimensions || isBusy(job)) return;
    try {
      // Validate both raw controls even if one is calculated by ratio locking.
      if (!width || !height || !Number.isInteger(Number(width)) || !Number.isInteger(Number(height))) throw new Error('Image dimensions exceed the browser safety limit (24 megapixels, 16,384 pixels per side).');
      const dimensions = resizeDimensions(job.sourceDimensions.width, job.sourceDimensions.height, keepAspect && axis === 'height' ? undefined : Number(width), Number(height), keepAspect);
      this.patch(id, { draftResize: { width: String(dimensions.width), height: String(dimensions.height) }, options: { ...job.options, resize: { ...dimensions, keepAspect } }, issues: { ...job.issues, resize: undefined }, status: 'ready', error: undefined });
    } catch (error) { this.patch(id, { draftResize: { width, height }, issues: { ...job.issues, resize: error instanceof Error ? error.message : '' } }); }
  }
  applyTarget(format: Format, target: Format) {
    for (const job of this.snapshot.items) if (job.status === 'ready' && job.format === format && job.mode === 'convert') this.configure(job.id, { target });
  }
  start = (id: string) => {
    const job = this.snapshot.items.find(i => i.id === id);
    if (!job?.input || !job.format || isBusy(job) || this.running.has(id) || job.issues?.name || job.issues?.resize) return;
    this.patch(id, { status: 'queued', progress: 0, error: undefined }); this.pump();
  };
  startAll = () => {
    this.publish(this.snapshot.items.map(i => i.input && i.format && i.status === 'ready' && !i.issues?.name && !i.issues?.resize && !this.running.has(i.id) ? { ...i, status: 'queued' as const } : i)); this.pump();
  };
  cancel = (id: string) => { this.running.get(id)?.controller.abort(); if (this.snapshot.items.some(i => i.id === id && ['queued', 'processing'].includes(i.status))) this.patch(id, { status: 'cancelled', progress: 0 }); };
  remove = (id: string) => {
    this.cancel(id); const oldIndex = this.snapshot.items.findIndex(i => i.id === id), items = this.snapshot.items.filter(i => i.id !== id);
    this.publish(items, { activeId: this.snapshot.activeId === id ? items[Math.min(oldIndex, items.length - 1)]?.id : this.snapshot.activeId });
  };
  clearCompleted = () => {
    const items = this.snapshot.items.filter(i => !isFinished(i));
    this.publish(items, { activeId: items.some(i => i.id === this.snapshot.activeId) ? this.snapshot.activeId : items[0]?.id });
  };
  clear = () => { this.epoch++; this.pendingInputs.clear(); this.running.forEach(i => i.controller.abort()); this.publish([], { activeId: undefined, notice: undefined }); };
  private pump() {
    while (this.running.size < 2) {
      const heavyRunning = [...this.running.values()].some(i => i.heavy);
      const job = this.snapshot.items.find(i => i.status === 'queued' && !this.running.has(i.id) && !(heavyRunning && ['pdf', 'docx', 'png', 'jpeg', 'webp'].includes(i.format!)) && this.execution.canAcquire(['pdf','docx','png','jpeg','webp'].includes(i.format!)));
      if (!job) break;
      const controller = new AbortController(), slot = { controller, input: job.input!, heavy: ['pdf', 'docx', 'png', 'jpeg', 'webp'].includes(job.format!) };
      const permission = this.execution.tryAcquire(`${this.prefix}-${job.id}`,slot.heavy); if(!permission)break; this.executionLeases.set(job.id,permission);
      this.running.set(job.id, slot); this.patch(job.id, { status: 'processing' });
      void this.execute(job, slot);
    }
  }
  private async execute(job: QueueItem, slot: { controller: AbortController }) {
    const { signal } = slot.controller;
    try {
      const result = await this.runner(job, { ...job.options, resourceBudget:this.budget, signal, onProgress: progress => { if (!signal.aborted && this.snapshot.items.some(i => i.id === job.id)) this.patch(job.id, { progress: Math.max(0, Math.min(1, progress)) }); } });
      if (signal.aborted || !this.snapshot.items.some(i => i.id === job.id)) return;
      if (this.snapshot.items.reduce((sum, i) => sum + (i.result?.blob.size ?? 0), 0) + result.blob.size > 128 * 1024 ** 2) throw new Error('Result memory limit reached (128 MB). Download and clear completed files, then retry.');
      // Keep only output blobs; large text is read lazily and bounded for the selected preview.
      const retained = { ...result, text: undefined };
      try {if(!this.resultLeases.has(result.blob))this.resultLeases.set(result.blob,this.budget.reserve('result',result.blob.size,`${this.prefix}-${job.id}`));} catch {throw new Error('Result memory limit reached (128 MB). Download and clear completed files, then retry.');}
      this.patch(job.id, { result: retained, input: undefined, status: result.warnings.length ? 'warning' : 'completed', progress: 1 });
    } catch (error) {
      if (!signal.aborted && this.snapshot.items.some(i => i.id === job.id)) this.patch(job.id, { status: 'failed', error: error instanceof Error ? error.message : 'Conversion failed. Try a smaller file or check its format.' });
    } finally { this.running.delete(job.id); this.executionLeases.get(job.id)?.release();this.executionLeases.delete(job.id);this.reconcile(); this.pump(); }
  }
}
