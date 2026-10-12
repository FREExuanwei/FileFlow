import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
const root=path.resolve('.npm-cache/phase65-fixtures');await mkdir(root,{recursive:true});
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(kind,data){const tag=Buffer.from(kind),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([len,tag,data,crc]);}
function png(width,height,data,metadataBytes=0){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)data.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),...(metadataBytes?[chunk('tEXt',Buffer.concat([Buffer.from('Fictional\0'),Buffer.alloc(metadataBytes,65)]))]:[]),chunk('IDAT',deflateSync(raw,{level:0})),chunk('IEND',Buffer.alloc(0))]);}
const probes=JSON.parse(await readFile(path.join(root,'raster-manifest.json'),'utf8'));
const pixels=await readFile(path.join(root,'mixed.rgb'));
function pdf(pages){
 const objects=[null,Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),null,Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')],kids=[];
 for(const p of pages){
  const image=objects.length;
  if(p.scan){const data=p.compressed?deflateSync(p.scan):p.scan;objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1800 /Height 600 /ColorSpace /DeviceRGB /BitsPerComponent 8 ${p.compressed?'/Filter /FlateDecode ':''}/Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]));}
  const content=objects.length,stream=Buffer.from(`${p.text?'BT /F1 18 Tf 40 350 Td (Fictional text layer: Alice 95 Bob 88. Local document.) Tj ET\n':''}${p.scan?'q 600 0 0 200 0 180 cm /Im1 Do Q\n':''}`);
  objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from('\nendstream')]));
  const id=objects.length;objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Resources << /Font << /F1 3 0 R >> ${p.scan?`/XObject << /Im1 ${image} 0 R >>`:''} >> /Contents ${content} 0 R >>`));kids.push(id);
 }
 objects[2]=Buffer.from(`<< /Type /Pages /Kids [${kids.map(i=>`${i} 0 R`).join(' ')}] /Count ${kids.length} >>`);
 const parts=[Buffer.from('%PDF-1.7\n')],offsets=[0];let offset=parts[0].length;
 for(let i=1;i<objects.length;i++){offsets.push(offset);const b=Buffer.concat([Buffer.from(`${i} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);parts.push(b);offset+=b.length;}
 parts.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));return Buffer.concat(parts);
}
await writeFile(path.join(root,'scanned.pdf'),pdf([{scan:pixels},{scan:pixels},{scan:pixels}]));await writeFile(path.join(root,'hybrid.pdf'),pdf([{text:true},{scan:pixels},{text:true}]));await writeFile(path.join(root,'large-scan-99MiB.pdf'),pdf(Array.from({length:32},()=>({scan:pixels}))));await writeFile(path.join(root,'scan-150MiB.pdf'),pdf(Array.from({length:49},()=>({scan:pixels}))));
// A text PDF containing real page image content, not a padded empty file.
await writeFile(path.join(root,'large-text-99MiB.pdf'),pdf(Array.from({length:32},()=>({scan:pixels,text:true}))));
await writeFile(path.join(root,'scan-51-pages.pdf'),pdf(Array.from({length:51},()=>({scan:pixels,compressed:true}))));
if(process.argv.includes('--pdf-only'))process.exit(0);
const rgba=Buffer.alloc(6000*4000*4,255);const small=await readFile(path.join(root,'mixed.rgba'));for(let y=0;y<600;y++)small.copy(rgba,y*6000*4,y*1800*4,(y+1)*1800*4);
await writeFile(path.join(root,'large-image-92MiB.png'),png(6000,4000,rgba));
await writeFile(path.join(root,'large-image-100MiB.png'),png(6000,4000,rgba,8*1024**2));await writeFile(path.join(root,'image-150MiB.png'),png(6000,4000,rgba,58*1024**2));
await writeFile(path.join(root,'corrupt.png'),Buffer.from([137,80,78,71,13,10,26,10]));const bomb=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bomb);bomb.writeUInt32BE(100000,16);bomb.writeUInt32BE(100000,20);await writeFile(path.join(root,'pixel-bomb.png'),bomb);
await writeFile(path.join(root,'manifest.json'),JSON.stringify({fictional:true,raster:probes,largePdf:'32 real RGB image streams; scan-only or visible reliable text per page',largeImage:'24 MP real RGBA raster; 92 MiB uncompressed PNG. Near100/150 variants add declared ancillary metadata, not extra pixels.',notPrivateData:true},null,2));console.log('Generated fictional scanned/hybrid/large documents; oversized metadata variants explicitly labeled.');
