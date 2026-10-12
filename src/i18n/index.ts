import { en } from './en';
import { zhCN } from './zh-CN';
import type { Language, MessageKey, Parameters } from './types';
export const LANGUAGE_KEY = 'fileflow.language';
export function initialLanguage(stored: string | null, languages: readonly string[]): Language {
  if (stored === 'en' || stored === 'zh-CN') return stored;
  try {
    const first = new Intl.Locale((languages[0] ?? 'en').replaceAll('_', '-')).maximize();
    return first.language === 'zh' && first.script === 'Hans' ? 'zh-CN' : 'en';
  } catch { return 'en'; }
}
export function translate(language: Language, key: MessageKey, parameters: Parameters = {}): string {
  return (language === 'en' ? en : zhCN)[key].replace(/\{(\w+)\}/g, (original: string, name: string) => String(parameters[name] ?? original));
}
export type { Language, MessageKey } from './types';
