import type { en } from './en';
export type Language = 'zh-CN' | 'en';
export type MessageKey = keyof typeof en;
export type Dictionary = { [Key in MessageKey]: string };
export type Parameters = Record<string, string | number>;
