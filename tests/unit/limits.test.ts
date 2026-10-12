import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDocxArchive } from '../../src/core/files/zip';
import { imageDimensions, validateDimensions } from '../../src/converters/image/dimensions';
import { convertersFor, converters } from '../../src/core/registry';

describe('resource caps and registry', () => {
  it('rejects pixel bombs before image decoding', () => {
    expect(() => validateDimensions(20000, 20000)).toThrow('24 megapixels');
    expect(() => validateDimensions(10000, 3000)).toThrow('safety');
    const bytes = new Uint8Array(readFileSync('tests/fixtures/demo.png'));
    expect(imageDimensions(bytes, 'png')).toEqual({ width: 128, height: 96 });
    new DataView(bytes.buffer).setUint32(16, 100000);
    expect(() => imageDimensions(bytes, 'png')).toThrow('safety');
  });
  it('rejects oversized expanded DOCX and unsafe ZIP paths', () => {
    const raw = new Uint8Array(readFileSync('tests/fixtures/demo.docx'));
    const bytes = new Uint8Array(raw.length); bytes.set(raw);
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22, start = view.getUint32(end + 16, true);
    view.setUint32(start + 24, 100 * 1024 ** 2, true);
    expect(() => validateDocxArchive(bytes.buffer)).toThrow('memory safety');
    view.setUint32(start + 24, 0, true);
    bytes[start + 46] = 46; bytes[start + 47] = 46;
    expect(() => validateDocxArchive(bytes.buffer)).toThrow('unsafe archive path');
  });
  it('rejects forged DOCX entry counts', () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/demo.docx'));
    const view = new DataView(bytes.buffer);
    view.setUint16(bytes.length - 22 + 10, 0, true);
    view.setUint16(bytes.length - 22 + 8, 0, true);
    expect(() => validateDocxArchive(bytes.buffer)).toThrow('directory');
  });
  it('lists exactly the fourteen implemented routes without invalid image identities', () => {
    expect(converters).toHaveLength(14);
    expect(convertersFor('pdf').map(item => item.output)).toEqual(['md', 'txt']);
    expect(convertersFor('png').map(item => item.output)).toEqual(['jpeg', 'webp']);
    expect(convertersFor('txt')).toEqual([]);
    expect(new Set(converters.map(item => item.id)).size).toBe(14);
  });
});
