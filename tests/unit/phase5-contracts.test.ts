import { expect, it } from 'vitest';
import { assertLimit, P5_LIMITS } from '../../src/core/phase5/limits';
import { errorCode, P5Error } from '../../src/core/phase5/errors';
it.each(Object.entries(P5_LIMITS))('rejects_each_limit_plus_one: %s', (name, max) => {
  expect(() => assertLimit(name as keyof typeof P5_LIMITS,max)).not.toThrow();
  expect(() => assertLimit(name as keyof typeof P5_LIMITS,max+1)).toThrow();
  expect(() => assertLimit(name as keyof typeof P5_LIMITS,NaN)).toThrow();
  expect(() => assertLimit(name as keyof typeof P5_LIMITS,-1)).toThrow();
});
it('never exposes a parser message as an error code',()=>{
  expect(errorCode(new Error('fictional private body'))).toBe('structure');
  expect(errorCode(new P5Error('budget'))).toBe('budget');
});
