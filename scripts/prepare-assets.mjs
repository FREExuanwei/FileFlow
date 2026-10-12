import { cpSync, mkdirSync } from 'node:fs';
const output = new URL('../public/pdf-assets/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(new URL(`../node_modules/pdfjs-dist/${folder}/`, import.meta.url), new URL(`${folder}/`, output), { recursive: true });
console.log('Prepared locally served PDF.js CMaps, fonts and WASM.');
