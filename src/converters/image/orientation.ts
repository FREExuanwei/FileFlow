/** Read only the EXIF orientation tag. Never retain metadata or execute its contents. */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) return 1;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) return 1;
      const length = view.getUint16(offset), end = offset + length;
      if (length < 2 || end > bytes.length) return 1;
      if (marker === 0xe1 && length >= 16 && bytes[offset + 2] === 69 && bytes[offset + 3] === 120 && bytes[offset + 4] === 105 && bytes[offset + 5] === 102 && bytes[offset + 6] === 0 && bytes[offset + 7] === 0) {
        const tiff = offset + 8, little = view.getUint16(tiff) === 0x4949;
        if (!little && view.getUint16(tiff) !== 0x4d4d) return 1;
        if (view.getUint16(tiff + 2, little) !== 42) return 1;
        const directory = tiff + view.getUint32(tiff + 4, little);
        if (directory < tiff + 8 || directory + 2 > end) return 1;
        const count = Math.min(view.getUint16(directory, little), 256);
        for (let i = 0; i < count; i++) {
          const entry = directory + 2 + i * 12;
          if (entry + 12 > end) return 1;
          if (view.getUint16(entry, little) === 0x112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
            const orientation = view.getUint16(entry + 8, little);
            return orientation >= 1 && orientation <= 8 ? orientation : 1;
          }
        }
      }
      offset = end;
    }
  } catch { /* Invalid optional metadata has no authority over dimensions. */ }
  return 1;
}
