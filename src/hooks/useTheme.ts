import {getDesktopPlatform} from '../adapters/platform';
import { useEffect, useState } from 'react';
type Theme = 'light' | 'dark' | 'system';
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const stored = localStorage.getItem('fileflow-theme'); return stored === 'light' || stored === 'dark' ? stored : 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  function update(value: Theme) { setTheme(value); try { localStorage.setItem('fileflow-theme', value);getDesktopPlatform()?.preference('fileflow-theme',value); } catch { /* Settings storage is optional. */ } }
  return { theme, setTheme: update };
}
