import { AiError, type AiSettings, type Preset } from './types';
export function settingsForPreset(preset: Preset): AiSettings {
  return { preset, cleanup: { mergeLines: preset !== 'conservative', removeHeaders: true, removeFooters: true, removePageNumbers: true, collapseBlankLines: true, normalizeHeadings: preset !== 'conservative', normalizeLists: preset !== 'conservative', candidateOverrides: {} }, chunking: { strategy: 'auto', targetEstimatedTokens: 4000, overlapPercent: 0 } };
}
export function validateSettings(settings: AiSettings): void {
  if (!settings || !['conservative','balanced','aggressive'].includes(settings.preset) || !settings.chunking || !['auto','headings','tokens'].includes(settings.chunking.strategy) || ![2000,4000,8000,16000].includes(settings.chunking.targetEstimatedTokens) || ![0,5,10].includes(settings.chunking.overlapPercent)) throw new AiError('invalid-settings');
  const expected = settingsForPreset(settings.preset).cleanup;
  for (const key of Object.keys(expected).filter(k => k !== 'candidateOverrides')) if (typeof settings.cleanup?.[key as keyof typeof expected] !== 'boolean') throw new AiError('invalid-settings');
  if (!settings.cleanup.candidateOverrides || Object.values(settings.cleanup.candidateOverrides).some(v => !['keep','remove'].includes(v))) throw new AiError('invalid-settings');
}
