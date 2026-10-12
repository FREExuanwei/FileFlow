import {readFileSync} from 'node:fs';
import {inspectArchive,sha256} from './review-phase5-package.mjs';
const members=inspectArchive(readFileSync('vendor/xlsx-0.20.3.tgz')),source=members.get('package/xlsx.mjs').toString(),lines=source.split('\n');
console.log('Source SHA256',sha256(Buffer.from(source)));
for(let i=0;i<lines.length;i++)if(/proto|Prototype|function parse_cmnt|function parse_comments|function parse_ws_xml|var tagregex|function parsexmltag|CRC32|CFB\.version|ssf\.version|SSF\.version|WMF|Codepage|copyright|Copyright|fetch\(|XMLHttpRequest|importScripts|require\(|^import\s|^export\s|\bnew Function\(/.test(lines[i]))console.log(`${i+1}: ${lines.slice(Math.max(0,i-1),i+3).join('\n')}`);
console.log('CHANGELOG',members.get('package/CHANGELOG.md').toString().slice(0,3600));
