import { describe, expect, it } from 'vitest';
import {
  createI18n,
  localeStorageKey,
  matchSupportedLocale,
  readStoredLocale,
  resolveInitialLocale,
  resolveNavigatorLocale,
  supportedLocales,
  translate,
} from './index';

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

describe('matchSupportedLocale', () => {
  it('normalizes supported English and Chinese locale aliases', () => {
    expect(matchSupportedLocale('en-US')).toBe('en');
    expect(matchSupportedLocale('EN_gb')).toBe('en');
    expect(matchSupportedLocale('zh-Hant')).toBe('zh-TW');
    expect(matchSupportedLocale('zh_HK')).toBe('zh-TW');
    expect(matchSupportedLocale('ja-JP')).toBe('ja');
  });

  it('returns an empty string for unsupported locales', () => {
    expect(matchSupportedLocale('fr-FR')).toBe('');
    expect(matchSupportedLocale('')).toBe('');
  });
});

describe('stored and initial locale resolution', () => {
  it('reads the stored locale when it can be normalized to a supported locale', () => {
    const storage = createStorage({
      [localeStorageKey]: 'zh-hant',
    });

    expect(readStoredLocale(storage)).toBe('zh-TW');
  });

  it('prefers stored locale over navigator locale', () => {
    const storage = createStorage({
      [localeStorageKey]: 'zh-TW',
    });

    expect(
      resolveInitialLocale({
        storageTarget: storage,
        navigatorLike: { language: 'en-US' },
      })
    ).toBe('zh-TW');
  });

  it('falls back to navigator locale and then default locale', () => {
    expect(resolveNavigatorLocale({ languages: ['fr-FR', 'en-GB'] })).toBe('en');
    expect(resolveInitialLocale({ navigatorLike: { language: 'fr-FR' } })).toBe('en');
  });
});

describe('translate', () => {
  it('returns localized messages with interpolation', () => {
    expect(translate('common.status.loaded', { count: 3 }, { locale: 'en' })).toBe('Loaded 3 items');
    expect(translate('common.status.loaded', { count: 3 }, { locale: 'zh-TW' })).toBe('已載入 3 個項目');
    expect(translate('common.status.loaded', { count: 3 }, { locale: 'ja' })).toBe('3 件を読み込みました');
  });

  it('falls back to the default locale when requested locale is unsupported', () => {
    expect(translate('common.actions.apply', {}, { locale: 'fr-FR' })).toBe('Apply');
  });

  it('returns the key when a message is missing', () => {
    expect(translate('missing.key', {}, { locale: 'en' })).toBe('missing.key');
  });
});

describe('createI18n', () => {
  it('tracks locale state and persists locale changes', () => {
    const storage = createStorage();
    const i18n = createI18n({
      storageTarget: storage,
      navigatorLike: { language: 'fr-FR' },
    });

    expect(i18n.locale.value).toBe('en');
    expect(i18n.t('common.language')).toBe('Language');
    expect(i18n.availableLocales.map(({ code }) => code)).toEqual(supportedLocales);

    i18n.setLocale('zh-HK');

    expect(i18n.locale.value).toBe('zh-TW');
    expect(storage.getItem(localeStorageKey)).toBe('zh-TW');
    expect(i18n.t('common.language')).toBe('語言');
  });

  it('exposes locale metadata for building dynamic locale pickers', () => {
    const i18n = createI18n();

    expect(i18n.getLocaleDefinition('ja')).toMatchObject({
      code: 'ja',
      nativeLabel: '日本語',
    });
  });
});
