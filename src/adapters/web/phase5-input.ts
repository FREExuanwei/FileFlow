import type {P5Input} from '../../core/phase5/types';
export function toP5Input(file:File):P5Input{
  const input:P5Input={name:file.name,type:file.type,size:file.size,blob:file};
  if(typeof file.lastModified==='number'&&Number.isFinite(file.lastModified)&&Math.abs(file.lastModified)<=8640000000000000)input.lastModified=file.lastModified;
  return input;
}
