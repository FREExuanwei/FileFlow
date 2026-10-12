import { describe, expect, it } from 'vitest';
import { detectFormat, validateSize } from '../../src/core/files/detect';
import { safeOutputName } from '../../src/core/files/names';

const input = (name: string, type: string, data: string) => ({ name, size: data.length, type, blob: new Blob([data], { type }) });
describe('file safety', () => {
  it('recognizes text by matching filename and MIME', async () => {
    expect(await detectFormat(input('fictional.csv', 'text/csv', 'name,score\nAlice,95'))).toBe('csv');
    expect(await detectFormat(input('DEMO.MD', 'text/plain', '# Demo'))).toBe('md');
  });
  it('rejects unsupported files, mismatched MIME and false binary extensions', async () => {
    await expect(detectFormat(input('demo.exe', '', 'fake'))).rejects.toThrow('Unsupported file type');
    await expect(detectFormat(input('demo.csv', 'image/png', 'fake'))).rejects.toThrow('does not match');
    await expect(detectFormat(input('demo.pdf', 'application/pdf', 'fake'))).rejects.toThrow('signature');
  });
  it('rejects empty and oversized files before conversion', () => {
    expect(() => validateSize(0, 'pdf')).toThrow('empty');
    expect(() => validateSize(41 * 1024 ** 2, 'pdf')).toThrow('40 MB');
  });
  it('creates portable basename-only output names', () => {
    expect(safeOutputName('../../private/demo.pdf', 'md')).toBe('demo.md');
    expect(safeOutputName('C:\\private\\demo.pdf', 'txt')).toBe('demo.txt');
    expect(safeOutputName('CON.pdf', 'md')).toBe('_CON.md');
    expect(safeOutputName('..', 'csv')).toBe('converted.csv');
    expect(safeOutputName('a\u202eb?.pdf', 'txt')).toBe('ab_.txt');
  });
});
