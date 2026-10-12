import type { MemoryLease, ResourceBudget } from '../resources/budget';
import type { OcrMemoryProfile } from './types';
import { OCR_LIMITS } from './limits';
export interface OcrRunReservation { engine: MemoryLease; transport: MemoryLease; release(): void }
export function reserveOcrRun(budget: ResourceBudget, owner: string, profile: OcrMemoryProfile): OcrRunReservation {
  const categories = [profile.engineBytes, profile.decodeBytes, profile.scratchBytes, profile.previewBytes, profile.transportBytes];
  if (categories.some(bytes => !Number.isSafeInteger(bytes) || bytes < 0)
    || profile.engineBytes === 0 || profile.transportBytes === 0
    || categories.reduce((sum, bytes) => sum + bytes, 0) > OCR_LIMITS.transientBytes
    || !Number.isSafeInteger(profile.maxRasterPixels) || profile.maxRasterPixels <= 0
    || profile.maxRasterPixels > OCR_LIMITS.rasterPixels) throw new Error('resource-limit');
  const engine = budget.reserve('transient', profile.engineBytes, `${owner}:engine`);
  try {
    const transport = budget.reserve('transient', profile.transportBytes, `${owner}:transport`);
    return { engine, transport, release() { transport.release(); engine.release(); } };
  } catch (error) { engine.release(); throw error; }
}
