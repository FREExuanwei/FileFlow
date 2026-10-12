interface ZipEntry { start: number; packed: number; size: number; method: number }
const MAX_EXPANSION = 80 * 1024 ** 2;

function entries(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('Invalid DOCX archive.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Multipart DOCX archives are unsupported.');
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true), directorySize = view.getUint32(end + 12, true);
  if (count > 2000 || count === 65535) throw new Error('DOCX has too many ZIP entries (limit: 2,000).');
  if (view.getUint16(end + 8, true) !== count || start + directorySize !== end || start > end) throw new Error('Invalid DOCX directory bounds.');
  let position = start, total = 0, hasDocument = false;
  const result: ZipEntry[] = [], names = new Set<string>(), spans: { start: number; end: number }[] = [];
  while (position < end) {
    if (result.length >= 2000 || position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw new Error('Invalid DOCX directory or entry count.');
    const flags = view.getUint16(position + 8, true);
    if (flags & 1) throw new Error('Encrypted DOCX files are unsupported.');
    const method = view.getUint16(position + 10, true);
    if (method !== 0 && method !== 8) throw new Error('Unsupported DOCX compression.');
    const packed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true), local = view.getUint32(position + 42, true);
    const nameLength = view.getUint16(position + 28, true);
    const next = position + 46 + nameLength + view.getUint16(position + 30, true) + view.getUint16(position + 32, true);
    if (next > end || size === 0xffffffff || packed === 0xffffffff || view.getUint16(position + 34, true)) throw new Error('Invalid or unsupported ZIP64 DOCX.');
    total += size;
    if (total > MAX_EXPANSION || (size > 1024 ** 2 && size / Math.max(1, packed) > 200)) throw new Error('DOCX expansion exceeds browser memory safety limits.');
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength), name = new TextDecoder().decode(nameBytes);
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || name.includes(':') || names.has(name)) throw new Error('DOCX contains an unsafe archive path.');
    names.add(name); if (name === 'word/document.xml') hasDocument = true;
    if (local + 30 > start || view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw new Error('Invalid DOCX local header.');
    const localNameLength = view.getUint16(local + 26, true), payload = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (payload + packed > start || localNameLength !== nameLength || !nameBytes.every((byte, i) => bytes[local + 30 + i] === byte)) throw new Error('Invalid DOCX local filename or offset.');
    if (!(flags & 8) && (view.getUint32(local + 18, true) !== packed || view.getUint32(local + 22, true) !== size)) throw new Error('Invalid DOCX ZIP size declarations.');
    result.push({ start: payload, packed, size, method }); spans.push({ start: local, end: payload + packed });
    position = next;
  }
  if (result.length !== count) throw new Error('Invalid DOCX directory entry count.');
  spans.sort((a,b) => a.start - b.start);
  if (spans.some((span, i) => i > 0 && span.start < spans[i - 1]!.end)) throw new Error('DOCX has overlapping ZIP entries.');
  if (!hasDocument) throw new Error('DOCX is missing its document content.');
  return result;
}
export function validateDocxArchive(buffer: ArrayBuffer): void { entries(buffer); }
export async function validateDocxContent(buffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
  let total = 0;
  for (const entry of entries(buffer)) {
    signal?.throwIfAborted();
    if (entry.method === 0) { if (entry.packed !== entry.size) throw new Error('Invalid DOCX stored ZIP size.'); total += entry.size; continue; }
    const stream = new Blob([new Uint8Array(buffer, entry.start, entry.packed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader = stream.getReader();
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    let size = 0;
    try {
      while (true) {
        signal?.throwIfAborted();
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength; total += chunk.value.byteLength;
        if (total > MAX_EXPANSION || size > entry.size) { await reader.cancel(); throw new Error('DOCX actual expansion exceeds its declared size or memory safety limit.'); }
      }
      if (size !== entry.size) throw new Error('DOCX has invalid decompressed ZIP sizes.');
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof Error && error.message.startsWith('DOCX')) throw error;
      throw new Error('DOCX contains invalid compressed data.', { cause: error });
    } finally { signal?.removeEventListener('abort', abort); reader.releaseLock(); }
  }
}
