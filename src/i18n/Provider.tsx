import {getDesktopPlatform} from '../adapters/platform';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initialLanguage, LANGUAGE_KEY, translate } from './index';
import { localizeEngineMessage } from './engine-messages';
import type { Language, MessageKey, Parameters } from './types';

type I18n = { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey, parameters?: Parameters) => string; message: (source: string, kind?: 'error' | 'warning') => string };
const Context = createContext<I18n | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANGUAGE_KEY); } catch { /* Preferences are optional. */ }
    return initialLanguage(stored, navigator.languages.length ? navigator.languages : [navigator.language]);
  });
  const t = (key: MessageKey, parameters?: Parameters) => translate(language, key, parameters);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, 'title');
    document.querySelector('meta[name=description]')?.setAttribute('content', translate(language, 'meta'));
  }, [language]);
  function update(value: Language) {
    setLanguage(value);
    try { localStorage.setItem(LANGUAGE_KEY, value);getDesktopPlatform()?.preference('fileflow-language',value); } catch { /* The interface still works without storage. */ }
  }
  return <Context value={{ language, setLanguage: update, t, message: (source, kind) => localizeEngineMessage(language, source, kind) }}>{children}</Context>;
}
export function useI18n(): I18n {
  const value = useContext(Context);
  if (!value) throw new Error('LanguageProvider is missing.');
  return value;
}
