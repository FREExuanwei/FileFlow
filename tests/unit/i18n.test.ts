import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialLanguage, translate } from '../../src/i18n';
import { en } from '../../src/i18n/en';
import { zhCN } from '../../src/i18n/zh-CN';
import { engineMessages, localizeEngineMessage } from '../../src/i18n/engine-messages';
import { formatLabel } from '../../src/i18n/formats';

describe('local interface language', () => {
  it('uses simplified Chinese locales and English for traditional Chinese and other locales', () => {
    for (const locale of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-MY', 'zh-Hans-TW', 'zh_CN']) expect(initialLanguage(null, [locale])).toBe('zh-CN');
    for (const locale of ['zh-TW', 'zh-HK', 'zh-Hant', 'en', 'de-DE', 'invalid']) expect(initialLanguage(null, [locale])).toBe('en');
  });
  it('respects only allowed saved choices and the first browser preference', () => {
    expect(initialLanguage('en', ['zh-CN'])).toBe('en');
    expect(initialLanguage('zh-CN', ['en'])).toBe('zh-CN');
    expect(initialLanguage('fr', ['zh-CN'])).toBe('zh-CN');
    expect(initialLanguage(null, ['en', 'zh-CN'])).toBe('en');
    expect(initialLanguage(null, [])).toBe('en');
  });
  it('keeps complete dictionary parity and interpolates values', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(zhCN).every(value => value.length > 0)).toBe(true);
    expect(translate('zh-CN', 'converting', { percent: 42 })).toBe('正在本地转换… 42%');
    expect(translate('en', 'pages', { count: 3 })).toContain('3 page');
    expect(formatLabel('zh-CN', 'docx')).toBe('DOCX');
    expect(formatLabel('zh-CN', 'txt')).toBe('纯文本');
    expect(formatLabel('en', 'txt')).toBe('Plain text');
  });
  it('presents useful Chinese safety errors and warning values without changing engine messages', () => {
    expect(localizeEngineMessage('zh-CN', 'This file exceeds the 40 MB browser safety limit for PDF. Try a smaller file.')).toContain('40 MB');
    expect(localizeEngineMessage('zh-CN', 'This file exceeds the 10 MB browser safety limit for Word document. Try a smaller file.')).toContain('DOCX');
    expect(localizeEngineMessage('zh-CN', '3 page(s) have no extractable text. Scanned content was not converted.', 'warning')).toContain('3 页');
    expect(localizeEngineMessage('zh-CN', 'Your browser does not support WEBP encoding.')).toContain('WEBP');
    expect(localizeEngineMessage('zh-CN', 'Invalid CSV: unexpected quote.')).toContain('CSV 格式无效');
    expect(localizeEngineMessage('zh-CN', 'Unexpected implementation detail')).toBe(zhCN.genericError);
    expect(localizeEngineMessage('zh-CN', 'Unexpected warning', 'warning')).toBe(zhCN.genericWarning);
    expect(localizeEngineMessage('en', 'Invalid JSON. Check quotes, commas and brackets.')).toBe('Invalid JSON. Check quotes, commas and brackets.');
  });
  it('covers every literal error emitted by current engines and task hook', () => {
    function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(path, item.name)) : [join(path, item.name)]); }
    const paths = [...files('src/core'), ...files('src/converters')];
    const literals = paths.flatMap(path => [...readFileSync(path, 'utf8').matchAll(/(?:new Error\(|setNotice\()'([^']+)'/g)].map(match => match[1]!));
    expect(literals.length).toBeGreaterThan(40);
    for (const source of literals) expect(engineMessages[source], source).toBeTruthy();
  });
});
