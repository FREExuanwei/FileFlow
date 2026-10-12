import {P5Error} from '../../core/phase5/errors';
export async function digestBytes(bytes:Uint8Array,algorithm:'SHA-256'|'SHA-512'):Promise<string>{
  if(algorithm!=='SHA-256'&&algorithm!=='SHA-512')throw new P5Error('type');
  const digest=await crypto.subtle.digest(algorithm,new Uint8Array(bytes));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
