import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const scanner=path.resolve('scripts/scan-secrets.mjs');
const marker=['-----BEGIN','PRIVATE','KEY-----'].join(' '); // Synthetic marker, no key material.
mkdirSync('.npm-cache',{recursive:true});

test('secret scan includes NSIS hook source',()=>{
 const dir=mkdtempSync(path.resolve('.npm-cache/phase8-secrets-'));
 const file=path.join(dir,'hooks.nsh');
 try{writeFileSync(file,marker);const r=spawnSync(process.execPath,[scanner],{cwd:dir,encoding:'utf8',windowsHide:true});assert.equal(r.status,1);assert.match(r.stderr,/hooks\.nsh/);assert.doesNotMatch(r.stderr,/BEGIN/);}
 finally{unlinkSync(file);rmdirSync(dir);}
});

test('secret scan still excludes dependency/build inputs',()=>{
 const dir=mkdtempSync(path.resolve('.npm-cache/phase8-secrets-'));
 const modules=path.join(dir,'node_modules'),file=path.join(modules,'hooks.nsh');
 try{mkdirSync(modules);writeFileSync(file,marker);const r=spawnSync(process.execPath,[scanner],{cwd:dir,encoding:'utf8',windowsHide:true});assert.equal(r.status,0);assert.match(r.stdout,/0 credential candidates/);}
 finally{unlinkSync(file);rmdirSync(modules);rmdirSync(dir);}
});
