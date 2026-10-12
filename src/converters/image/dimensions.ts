import { jpegOrientation } from './orientation';
export function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 24000000) throw new Error('Image dimensions exceed the browser safety limit (24 megapixels, 16,384 pixels per side).');
}
export function imageDimensions(bytes: Uint8Array, format: 'png' | 'jpeg' | 'webp'): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  try {
    if (format === 'png') { width = view.getUint32(16); height = view.getUint32(20); }
    else if (format === 'jpeg') {
      let i = 2;
      while (i + 4 < bytes.length) {
        if (bytes[i] !== 255) break;
        while (bytes[i] === 255) i++;
        const marker = bytes[i++];
        if (marker === 0xd9 || marker === 0xda) break;
        const length = view.getUint16(i);
        if (length < 2) break;
        if (marker !== undefined && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) { height = view.getUint16(i + 3); width = view.getUint16(i + 5); break; }
        i += length;
      }
    } else {
      const kind = new TextDecoder().decode(bytes.subarray(12, 16));
      if (kind === 'VP8X') { width = 1 + (bytes[24]! | bytes[25]! << 8 | bytes[26]! << 16); height = 1 + (bytes[27]! | bytes[28]! << 8 | bytes[29]! << 16); }
      else if (kind === 'VP8L' && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff); }
      else if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) { width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff; }
    }
  } catch { throw new Error('Unable to read image dimensions. The image may be damaged.'); }
  if (!width || !height) throw new Error('Unable to read image dimensions. The image may be damaged or unsupported.');
  validateDimensions(width, height);
  if (format === 'jpeg' && jpegOrientation(bytes) >= 5) return { width: height, height: width };
  return { width, height };
}
