// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validateDocxContent } from '../../src/core/files/zip';

function archive() { const bytes = new Uint8Array(readFileSync('tests/fixtures/demo.docx')); return bytes.buffer; }
it('validates real decompressed sizes for generated DOCX', async () => {
  await expect(validateDocxContent(archive())).resolves.toBeUndefined();
});
it('rejects forged compressed expansion even if local and central sizes agree', async () => {
  const buffer = archive(), view = new DataView(buffer);
  const central = view.getUint32(buffer.byteLength - 22 + 16, true), local = view.getUint32(central + 42, true);
  view.setUint32(central + 24, 1, true); view.setUint32(local + 22, 1, true);
  await expect(validateDocxContent(buffer)).rejects.toThrow('actual expansion');
});
it('honors cancellation during streamed archive preflight', async () => {
  const controller = new AbortController();
  const promise = validateDocxContent(archive(), controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});
