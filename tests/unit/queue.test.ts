import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ConversionQueue } from '../../src/core/queue/store';
import { recommendations } from '../../src/core/queue/recommendations';
import { renameOutput } from '../../src/core/queue/names';
import { resizeDimensions } from '../../src/converters/image/resize';
import { safeOutputName } from '../../src/core/files/names';
import type { ConversionResult, InputFile } from '../../src/core/conversion/types';

const file = (name = 'demo.csv'): InputFile => ({ name, type: 'text/csv', size: 4, blob: new Blob(['a\n1\n']) });
const result = (): ConversionResult => ({ name: 'demo.json', format: 'json', blob: new Blob(['[]']), text: '[]', warnings: [] });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('bounded memory-only conversion queue', () => {
  it('adds independently, recommends supported routes, and clears completed items', async () => {
    const q = new ConversionQueue({ run: async () => result() });
    await q.add([file(), file('other.csv')]);
    expect(q.getSnapshot().items.map(i => i.status)).toEqual(['ready', 'ready']);
    q.startAll(); await tick(); await tick();
    expect(q.getSnapshot().items.every(i => i.status === 'completed' && !i.input && !i.result?.text)).toBe(true);
    q.clearCompleted(); expect(q.getSnapshot().items).toHaveLength(0);
    expect(recommendations('pdf').map(i => i.output)).toEqual(['md', 'txt']);
    expect(recommendations('png')[0]?.output).toBe('webp');
    expect(recommendations('txt')).toEqual([]);
  });
  it('continues after failure and retries only the failed job', async () => {
    let fail = true;
    const q = new ConversionQueue({ run: async job => { if (job.name === 'bad.csv' && fail) throw new Error('Invalid JSON. Check quotes, commas and brackets.'); return result(); } });
    await q.add([file('bad.csv'), file('good.csv')]); q.startAll(); await tick(); await tick();
    expect(q.getSnapshot().items.map(i => i.status)).toEqual(['failed', 'completed']);
    fail = false; q.start(q.getSnapshot().items[0]!.id); await tick(); await tick();
    expect(q.getSnapshot().items.map(i => i.status)).toEqual(['completed', 'completed']);
  });
  it('holds cancelled execution slots until settlement and discards removed late results', async () => {
    const releases: (() => void)[] = []; let active = 0, peak = 0;
    const q = new ConversionQueue({ run: async () => { active++; peak = Math.max(peak, active); await new Promise<void>(resolve => releases.push(resolve)); active--; return result(); } });
    await q.add([file('1.csv'), file('2.csv'), file('3.csv')]); q.startAll(); await tick();
    expect(active).toBe(2); const id = q.getSnapshot().items[0]!.id;
    q.remove(id); await tick(); expect(active).toBe(2);
    releases.shift()!(); await tick(); expect(active).toBe(2);
    releases.splice(0).forEach(resolve => resolve()); await tick();
    expect(peak).toBe(2); expect(q.getSnapshot().items.some(i => i.id === id)).toBe(false);
    expect(q.getSnapshot().items.every(i => i.status === 'completed')).toBe(true);
  });
  it('reserves deterministic collision names regardless of completion order', async () => {
    const releases: (() => void)[] = [];
    const q = new ConversionQueue({ run: async () => { await new Promise<void>(resolve => releases.push(resolve)); return result(); } });
    await q.add([file(), file()]); q.startAll(); await tick();
    releases[1]!(); await tick(); releases[0]!(); await tick();
    expect(q.getSnapshot().items.map(i => i.result?.name)).toEqual(['demo.json', 'demo (1).json']);
    q.rename(q.getSnapshot().items[0]!.id, 'final');
    expect(q.getSnapshot().items.map(i => i.result?.name)).toEqual(['final.json', 'demo.json']);
  });
  it('serializes heavy documents while allowing a light conversion alongside them', async () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/demo.pdf')).buffer;
    const pdf = (name: string): InputFile => ({ name, type: 'application/pdf', size: bytes.byteLength, blob: new Blob([bytes]) });
    const releases: (() => void)[] = [], started: string[] = [];
    const q = new ConversionQueue({ run: async job => { started.push(job.name); await new Promise<void>(resolve => releases.push(resolve)); return result(); } });
    await q.add([pdf('1.pdf'), pdf('2.pdf'), file()]); q.startAll(); await tick();
    expect(started).toEqual(['1.pdf', 'demo.csv']);
    releases[0]!(); await tick(); expect(started).toEqual(['1.pdf', 'demo.csv', '2.pdf']);
    releases.slice(1).forEach(resolve => resolve()); await tick();
    expect(q.getSnapshot().items.every(i => i.status === 'completed')).toBe(true);
  });
  it('reserves import limits synchronously and clear cannot resurrect pending files', async () => {
    const q = new ConversionQueue();
    const first = q.add(Array.from({ length: 40 }, (_, i) => file(`${i}.csv`)));
    const second = q.add(Array.from({ length: 40 }, (_, i) => file(`${i + 40}.csv`)));
    await Promise.all([first, second]); expect(q.getSnapshot().items).toHaveLength(50); expect(q.getSnapshot().notice).toContain('Queue limit');
    q.clear(); const pending = q.add([file()]); q.clear(); await pending; expect(q.getSnapshot().items).toHaveLength(0);
    await q.add([{ ...file(), size: 201 * 1024 ** 2 }]); expect(q.getSnapshot().items).toHaveLength(0); expect(q.getSnapshot().notice).toContain('200 MB');
  });
  it('discards over-budget output and retains its source for retry', async () => {
    const blob = new Blob(['fictional']); Object.defineProperty(blob, 'size', { value: 128 * 1024 ** 2 + 1 });
    const q = new ConversionQueue({ run: async () => ({ ...result(), blob }) });
    await q.add([file()]); q.startAll(); await tick();
    expect(q.getSnapshot().items[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('128 MB') });
    expect(q.getSnapshot().items[0]?.result).toBeUndefined(); expect(q.getSnapshot().items[0]?.input).toBeDefined();
  });
  it('keeps invalid drafts across selection and prevents both single and batch start', async () => {
    const q = new ConversionQueue({ run: async () => result() });
    await q.add([file(), file('other.csv')]); const first = q.getSnapshot().items[0]!.id;
    q.editName(first, '../bad'); q.select(q.getSnapshot().items[1]!.id); q.select(first);
    expect(q.getSnapshot().items[0]?.draftName).toBe('../bad');
    q.start(first); q.startAll(); await tick();
    expect(q.getSnapshot().items.map(i => i.status)).toEqual(['ready', 'completed']);
    q.editName(first, 'fixed'); q.startAll(); await tick(); expect(q.getSnapshot().items[0]?.status).toBe('completed');
  });
  it('collision suffixes survive the download adapter length limit', async () => {
    const q = new ConversionQueue({ run: async () => result() });
    await q.add([file(), file()]); q.getSnapshot().items.forEach(i => q.rename(i.id, 'a'.repeat(120)));
    q.startAll(); await tick();
    const names = q.getSnapshot().items.map(i => i.result!.name);
    expect(names[1]).toBe(`${'a'.repeat(116)} (1).json`);
    expect(names[0]).not.toBe(names[1]); expect(names.every(name => name.slice(0, -5).length <= 120)).toBe(true);
    expect(names.map(name => safeOutputName(name, 'json'))).toEqual(names);
  });
  it('reselects a released source in the same task and protects its result on invalid reselection', async () => {
    const q = new ConversionQueue({ run: async () => result() });
    await q.add([file()]); const id = q.getSnapshot().items[0]!.id; q.rename(id, 'report'); q.start(id); await tick();
    const bytes = new Uint8Array(readFileSync('tests/fixtures/demo.pdf')).buffer;
    await q.restore(id, { name: 'other.pdf', type: 'application/pdf', size: bytes.byteLength, blob: new Blob([bytes]) });
    expect(q.getSnapshot().items[0]).toMatchObject({ status: 'completed', result: { name: 'report.json' }, error: expect.stringContaining('same format') });
    await q.restore(id, file('again.csv'));
    expect(q.getSnapshot().items).toHaveLength(1); expect(q.getSnapshot().items[0]).toMatchObject({ status: 'ready', name: 'again.csv', basename: 'report', target: 'json' });
    expect(q.getSnapshot().items[0]?.result).toBeUndefined(); q.start(id); await tick(); expect(q.getSnapshot().items[0]?.result?.name).toBe('report.json');
  });
});
describe('output controls', () => {
  it('rejects traversal, reserved names and invalid output dimensions', () => {
    for (const name of ['../out', 'C:\\out', 'CON', 'nul.txt', 'bad?', '', '..']) expect(() => renameOutput(name, 'md')).toThrow();
    expect(renameOutput('my.report', 'md')).toBe('my.report.md');
    for (const width of [NaN, Infinity, 0, -1, 1.5, 16385]) expect(() => resizeDimensions(128, 96, width, 96, false)).toThrow();
    expect(() => resizeDimensions(128, 96, 6000, 6000, false)).toThrow();
    expect(resizeDimensions(128, 96, 64, undefined, true)).toEqual({ width: 64, height: 48 });
    expect(resizeDimensions(128, 96, undefined, 48, true)).toEqual({ width: 64, height: 48 });
    expect(resizeDimensions(128, 96, 64, 32, false)).toEqual({ width: 64, height: 32 });
  });
});
