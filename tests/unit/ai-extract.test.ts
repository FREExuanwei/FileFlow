import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { detectAiFormat, extractAiDocument } from '../../src/converters/ai-ready/extract';
import { detectFormat } from '../../src/core/files/detect';
import { htmlToMarkdown } from '../../src/converters/markup/transform';
const input = (name: string, text: string | Uint8Array, type = 'text/plain') => { const blob = new Blob([text as BlobPart]); return { name, blob, size: blob.size, type }; };
it('txt_is_ai_only_and_strict_utf8', async () => {
  const f = input('fictional.txt','虚构文字\nEnglish.');
  expect(await detectAiFormat(f)).toBe('txt');
  expect((await extractAiDocument(f,{})).pages[0]?.markdown).toContain('虚构文字');
  await expect(detectFormat(f)).rejects.toThrow('Unsupported');
  await expect(extractAiDocument(input('x.txt',new Uint8Array([255])),{})).rejects.toThrow('invalid-encoding');
  await expect(detectAiFormat(input('x.txt','hello','image/png'))).rejects.toThrow('invalid-mime');
  await expect(detectAiFormat(input('x.txt',''))).rejects.toThrow('empty-input');
  await expect(detectAiFormat({ ...f,size:11*1024**2 })).rejects.toThrow('input-limit');
});
it('markup_keeps_semantics_and_code_language_spacing', async () => {
  const source = readFileSync('tests/fixtures/ai-structure.md','utf8');
  expect((await extractAiDocument(input('demo.md',source),{})).pages[0]?.markdown).toBe(source);
  const html = readFileSync('tests/fixtures/ai-code.html','utf8');
  const md = htmlToMarkdown(html,{ preserveCodeLanguage: true });
  expect(md).toContain('```js\nconst fictional = 1;\n  console.log(fictional);');
  expect(md).toContain('# Fictional Guide');
  expect(md).toMatch(/-\s+Fictional/);
  expect(htmlToMarkdown('<script>alert(1)</script><pre><code class="language-js evil">a\n  b</code></pre>',{preserveCodeLanguage:true})).not.toContain('evil');
});
