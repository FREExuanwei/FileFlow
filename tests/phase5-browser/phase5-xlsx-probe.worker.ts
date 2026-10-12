import {preflightXlsx} from '../../src/converters/phase5/xlsx/zip-preflight';
import {readSelectedSheet} from '../../src/converters/phase5/xlsx/parser';
import {errorCode} from '../../src/core/phase5/errors';
import type {P5Message} from '../../src/core/phase5/types';
const scope=self as unknown as {onmessage:((event:MessageEvent<P5Message<{input:{blob:Blob}}>>)=>void)|null;postMessage:(data:unknown)=>void};
scope.onmessage=async({data})=>{try{const bytes=new Uint8Array(await data.payload.input.blob.arrayBuffer()),signal=new AbortController().signal,envelope=await preflightXlsx(bytes,{signal}),raw=await readSelectedSheet(bytes,'rId1',envelope,signal),{normalizeSheet}=await import('../../src/converters/phase5/xlsx/normalize'),normalized=normalizeSheet(raw,envelope,'rId1');scope.postMessage({...data,payload:{type:'result',value:{...normalized,rows:normalized.rows.slice(0,20).map(row=>row.slice(0,20))}}});}catch(error){scope.postMessage({...data,payload:{type:'error',code:errorCode(error)}});}};
