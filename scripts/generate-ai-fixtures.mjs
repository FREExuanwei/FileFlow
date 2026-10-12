import { writeFileSync } from 'node:fs';
const directory = new URL('../tests/fixtures/', import.meta.url);
function pdf(ambiguous) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const ids = [];
  for (let page = 1; page <= 4; page++) {
    const id = objects.length + 1; ids.push(id);
    const stream = `BT /F1 10 Tf 72 ${ambiguous ? 740 : 800} Td (Fictional Guide) Tj 0 -${ambiguous ? 16 : 80} Td (This is a fictional paragraph on page ${page}.) Tj 0 -16 Td (A long sentence is broken) Tj 0 -16 Td (across two lines for testing.) Tj 0 -${ambiguous ? 652 : 648} Td (Fictional Footer) Tj 0 -20 Td (Page ${page}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 11 0 R >> >> /Contents ${id+1} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${ids.map(id => `${id} 0 R`).join(' ')}] /Count 4 >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let output = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(output)); output += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return output;
}
writeFileSync(new URL('ai-repeated.pdf',directory),pdf(false));
writeFileSync(new URL('ai-ambiguous.pdf',directory),pdf(true));
writeFileSync(new URL('ai-structure.md',directory),'# 虚构文档 Fictional Guide\n\n人工智能已经成为\n计算机科学的重要方向。\n\n## Code\n\n```js\nconst fictional = 1;\n  console.log(fictional);\n```\n\n## List\n\n- Fictional item\n- 虚构条目\n\n| Name | Value |\n| --- | --- |\n| Fictional | 2 |\n');
writeFileSync(new URL('ai-code.html',directory),'<h1>Fictional Guide</h1><pre><code class="language-js">const fictional = 1;\n  console.log(fictional);\n</code></pre><h2>List</h2><ul><li>Fictional</li></ul>');
writeFileSync(new URL('ai-mixed.txt',directory),'Fictional local document\n\n人工智能已经成为\n计算机科学的重要方向。\n\nThis is a very long\nsentence split across lines.\n');

// Clean text-only PDF: unique complete sentences, no repeated headers/footers.
function cleanMediumPdf(){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',''],ids=[];
  for(let page=1;page<=8;page++){
    const id=objects.length+1;ids.push(id);
    const body=Array.from({length:40},(_,line)=>`BT /F1 8 Tf 72 ${700-line*12} Td (Fictional page ${page}, line ${line+1}: This clean sentence uses generated examples for a simple study document.) Tj ET`).join('\n');
    const stream=body+`\nBT /F1 8 Tf 72 20 Td (Page ${page}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 19 0 R >> >> /Contents ${id+1} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Kids [${ids.map(id=>`${id} 0 R`).join(' ')}] /Count 8 >>`;objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let output='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(output);
  return output+`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
writeFileSync(new URL('ai-clean-medium.pdf',directory),cleanMediumPdf());
