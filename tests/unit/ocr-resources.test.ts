import { expect, it } from 'vitest';
import { ResourceBudget } from '../../src/core/resources/budget';
import { INITIAL_OCR_PROFILE as profile, MIB } from '../../src/core/ocr/limits';
import { reserveOcrRun } from '../../src/core/ocr/resources';

it('transient_256_mib_plus_one_fails_closed', () => {
  const budget = new ResourceBudget();
  expect(() => budget.reserve('transient', 256 * MIB + 1, 'fictional')).toThrow('resource-limit');
  const full = budget.reserve('transient', 256 * MIB, 'fictional');
  expect(() => budget.reserve('transient', 1, 'extra')).toThrow('resource-limit');
  expect(budget.getTransientUsage()).toBe(256 * MIB);
  expect(budget.getUsage()).toEqual({ tasks: 0, sourceBytes: 0, resultBytes: 0 }); full.release();
});
it('failed_resize_does_not_erase_other_leases', () => {
  const budget = new ResourceBudget(), source = budget.reserve('source', 100, 'source');
  const a = budget.reserve('transient', 128 * MIB, 'a'), b = budget.reserve('transient', 120 * MIB, 'b');
  expect(() => a.resize(137 * MIB)).toThrow('resource-limit');
  expect(budget.getTransientUsage()).toBe(248 * MIB);
  a.release(); expect(budget.getTransientUsage()).toBe(120 * MIB); expect(budget.getUsage().sourceBytes).toBe(100);
  b.release(); source.release();
});
it('release_is_idempotent_and_notifies_shared_subscribers', async () => {
  const budget = new ResourceBudget(), lease = budget.reserve('transient', 8 * MIB, 'fictional');
  let notifications = 0; const unsubscribe = budget.subscribe(() => notifications++);
  lease.release(); lease.release(); await Promise.resolve(); unsubscribe();
  expect(budget.getTransientUsage()).toBe(0); expect(notifications).toBe(1);
  expect(() => lease.resize(1)).toThrow('resource-limit');
});
it('source_result_limits_stay_200_128', () => {
  const budget = new ResourceBudget(), source = budget.reserve('source', 200 * MIB, 'source'), result = budget.reserve('result', 128 * MIB, 'result');
  const transient = budget.reserve('transient', 256 * MIB, 'ocr');
  expect(() => source.resize(200 * MIB + 1)).toThrow('resource-limit');
  expect(() => result.resize(128 * MIB + 1)).toThrow('resource-limit');
  expect(budget.getUsage()).toEqual({ tasks: 0, sourceBytes: 200 * MIB, resultBytes: 128 * MIB });
  source.release(); result.release(); transient.release();
});
it('run_reserves_engine_and_transport_once_not_page_or_preview_bytes', () => {
  const budget = new ResourceBudget(), run = reserveOcrRun(budget, 'fictional', profile);
  expect(budget.getTransientUsage()).toBe(144 * MIB);
  const decode = budget.reserve('transient', profile.decodeBytes, 'decode'), scratch = budget.reserve('transient', profile.scratchBytes, 'scratch'), preview = budget.reserve('transient', profile.previewBytes, 'preview');
  expect(budget.getTransientUsage()).toBe(256 * MIB);
  run.release(); run.release(); expect(budget.getTransientUsage()).toBe(112 * MIB);
  decode.release(); scratch.release(); preview.release(); expect(budget.getTransientUsage()).toBe(0);
});
it('failed_atomic_run_reservation_preserves_existing_source_result_and_transient', () => {
  const budget = new ResourceBudget(); budget.reserve('source', 10, 'source'); budget.reserve('result', 20, 'result');
  const other = budget.reserve('transient', 120 * MIB, 'other');
  expect(() => reserveOcrRun(budget, 'ocr', profile)).toThrow('resource-limit');
  expect(budget.getTransientUsage()).toBe(120 * MIB);
  expect(budget.getUsage()).toEqual({ tasks: 0, sourceBytes: 10, resultBytes: 20 }); other.release();
});
it.each([NaN, -1, .5, Infinity])('invalid_transient_bytes_%s_fail_closed', bytes => {
  const budget = new ResourceBudget(); expect(() => budget.reserve('transient', bytes, 'invalid')).toThrow('resource-limit');
  expect(budget.getTransientUsage()).toBe(0);
});
it('profile_cannot_raise_total_cap_or_pixel_cap', () => {
  const budget = new ResourceBudget();
  expect(() => reserveOcrRun(budget, 'ocr', { ...profile, engineBytes: 256 * MIB })).toThrow('resource-limit');
  expect(() => reserveOcrRun(budget, 'ocr', { ...profile, maxRasterPixels: 6_000_001 })).toThrow('resource-limit');
  expect(budget.getTransientUsage()).toBe(0);
});
