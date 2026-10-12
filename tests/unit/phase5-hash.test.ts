// @vitest-environment node
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {digestBytes} from '../../src/converters/phase5/hash-core';
for(const algorithm of ['SHA-256','SHA-512'] as const)for(const [name,bytes] of [['empty',new Uint8Array()],['abc',new TextEncoder().encode('abc')],['binary',Uint8Array.from({length:256},(_,i)=>i)]] as const)it(`${algorithm} real WebCrypto ${name} matches independent Node`,async()=>{
  expect(await digestBytes(bytes,algorithm)).toBe(createHash(algorithm.replace('-','').toLowerCase()).update(bytes).digest('hex'));
});
