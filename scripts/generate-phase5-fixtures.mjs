import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const group=process.argv[process.argv.indexOf('--group')+1];
if(group!=='data'&&group!=='yaml')throw new Error('Unsupported fictional fixture group');
const files=group==='yaml'?{
  'fictional.yaml':Buffer.from('# Fictional only\ntitle: 虚构\ndate: 2026-01-02\nbase: &b [1, two]\ncopy: *b\n'),
  'fictional-cycle.yaml':Buffer.from('a: &a [*a]\n'),
}: {
  'fictional.csv':Buffer.from('name,note\r\n虚构,"comma, quote "" and\nnewline\ttab"'),
  'fictional.tsv':Buffer.from('__proto__\tconstructor\tprototype\r\none\ttwo\tthree'),
  'fictional.json':Buffer.from('[{"name":"虚构","number":-42,"text":"-42"}]'),
  'invalid-utf8.csv':Buffer.from([0x61,0x0a,0xc3,0x28]),
};
const directory='tests/phase5-fixtures';mkdirSync(directory,{recursive:true});
for(const [name,bytes] of Object.entries(files))writeFileSync(`${directory}/${name}`,bytes);
writeFileSync(`${directory}/${group}-manifest.json`,JSON.stringify({fictional:true,command:`node scripts/generate-phase5-fixtures.mjs --group ${group}`,files:Object.entries(files).map(([name,bytes])=>({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))},null,2)+'\n');
console.log(`Generated ${Object.keys(files).length} fictional fixtures.`);
