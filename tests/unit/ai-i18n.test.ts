import { expect,it } from 'vitest';
import { phase3En,phase3Zh } from '../../src/i18n/phase3';
it('phase3_dictionaries_have_same_keys_and_estimate_copy',()=>{
  expect(Object.keys(phase3Zh).sort()).toEqual(Object.keys(phase3En).sort());
  expect(phase3En.aiEstimated).toContain('Estimated tokens');expect(phase3Zh.aiEstimated).toContain('预估 Token');
  expect(phase3En.aiEstimateNote).toContain('billing');expect(phase3En.aiDownloadNote).toContain('individually');
});
