import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateRawSync, deflateSync } from 'node:zlib';

const dir = new URL('../tests/fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(content), packed = deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, filename, packed); centrals.push(central, filename);
    offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function pdf(text = true) {
  const stream = text ? 'BT /F1 24 Tf 72 750 Td (FileFlow Demo PDF) Tj /F1 18 Tf 0 -45 Td (Section One) Tj /F1 12 Tf 0 -30 Td (This is fictional sample content.) Tj ET' : '';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const start = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return output;
}
writeFileSync(new URL('demo.pdf', dir), pdf());
writeFileSync(new URL('no-text.pdf', dir), pdf(false));
writeFileSync(new URL('corrupt.pdf', dir), '%PDF-1.4\nfictional corrupted sample');
const p = (text, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const doc = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('FileFlow Demo Document', 'Heading1')}${p('Section One', 'Heading2')}${p('This file contains fictional test data.')}<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold sample</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t> italic sample</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Fictional list item</w:t></w:r></w:p><w:tbl><w:tr><w:tc>${p('Name')}</w:tc><w:tc>${p('Score')}</w:tc></w:tr><w:tr><w:tc>${p('Alice')}</w:tc><w:tc>${p('95')}</w:tc></w:tr></w:tbl></w:body></w:document>`;
writeFileSync(new URL('demo.docx', dir), zip({
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': doc,
  'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>',
  'word/styles.xml': '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>',
  'word/numbering.xml': '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>',
}));
function chunk(name, data) {
  const type = Buffer.from(name), result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); type.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), result.length - 4);
  return result;
}
const width = 128, height = 96, ihdr = Buffer.alloc(13), raw = Buffer.alloc((width * 4 + 1) * height);
ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = y * (width * 4 + 1) + 1 + x * 4;
  raw[i] = 100 + x; raw[i + 1] = 70 + y; raw[i + 2] = 230; raw[i + 3] = x < 30 ? 0 : 255;
}
writeFileSync(new URL('demo.png', dir), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
for (const [name, text] of Object.entries({ 'demo.csv': 'name,score\nAlice,95\nBob,88\n', 'demo.json': '[{"name":"Alice","score":95},{"name":"Bob","score":88}]', 'demo.md': '# FileFlow Demo\n\nThis is **fictional** sample content.\n', 'demo.html': '<h1>FileFlow Demo</h1><p>Fictional <strong>sample</strong>.</p>', 'README.md': 'All samples are fictional and generated by scripts/generate-fixtures.mjs. No personal files were read. no-text.pdf intentionally has no text layer.\n' })) writeFileSync(new URL(name, dir), text);
console.log('Generated fictional PDF, DOCX, PNG, CSV, JSON, Markdown and HTML fixtures.');
await import('./generate-ai-fixtures.mjs');
