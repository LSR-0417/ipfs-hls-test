import { inject, readonly, ref } from 'vue';
import en from './messages/en';
import ja from './messages/ja';
import zhTW from './messages/zh-TW';
import { getLocaleDefinition, localeAliasMap, localeDefinitions } from './locales';

export const localeStorageKey = 'ipfs-hls-locale';
export const defaultLocale = 'en';
export const fallbackLocale = defaultLocale;
export const messages = Object.freeze({
  en,
  ja,
  'zh-TW': zhTW,
});
export const supportedLocales = Object.freeze(localeDefinitions.map(({ code }) => code));

const I18N_SYMBOL = Symbol('ipfs-hls-i18n');

function resolveStorage(target) {
  if (target && typeof target.getItem === 'function') {
    return target;
  }

  if (target?.localStorage && typeof target.localStorage.getItem === 'function') {
    return target.localStorage;
  }

  if (typeof window !== 'undefined' && window?.localStorage && typeof window.localStorage.getItem === 'function') {
    return window.localStorage;
  }

  return null;
}

function normalizeLocaleCandidate(value) {
  return typeof value === 'string' ? value.trim().replace(/_/g, '-').toLowerCase() : '';
}

function resolveFallbackLocale(value) {
  return supportedLocales.includes(value) ? value : fallbackLocale;
}

function getAvailableLocaleDefinitions(catalog = messages) {
  return localeDefinitions.filter(({ code }) => Object.prototype.hasOwnProperty.call(catalog, code));
}

function readMessageValue(locale, key, catalog) {
  const localeMessages = catalog[locale];
  if (!localeMessages) return '';

  const result = String(key || '')
    .split('.')
    .reduce((current, part) => {
      if (current && typeof current === 'object') {
        return current[part];
      }

      return undefined;
    }, localeMessages);

  return typeof result === 'string' ? result : '';
}

export function matchSupportedLocale(value) {
  const normalized = normalizeLocaleCandidate(value);
  if (!normalized) return '';

  if (localeAliasMap[normalized]) {
    return localeAliasMap[normalized];
  }

  const exactMatch = supportedLocales.find((locale) => locale.toLowerCase() === normalized);
  if (exactMatch) {
    return exactMatch;
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  if (normalized.startsWith('zh')) {
    return 'zh-TW';
  }

  return '';
}

export function resolveLocale(value, options = {}) {
  return matchSupportedLocale(value) || resolveFallbackLocale(options.fallbackLocale);
}

export function readStoredLocale(target) {
  const storage = resolveStorage(target);
  if (!storage) return '';

  try {
    return matchSupportedLocale(storage.getItem(localeStorageKey));
  } catch (_) {
    return '';
  }
}

export function persistStoredLocale(locale, target) {
  const storage = resolveStorage(target);
  if (!storage) return '';

  const nextLocale = resolveLocale(locale);

  try {
    storage.setItem(localeStorageKey, nextLocale);
  } catch (_) {
    return '';
  }

  return nextLocale;
}

export function resolveNavigatorLocale(navigatorLike, options = {}) {
  const fallback = resolveFallbackLocale(options.fallbackLocale);
  const candidates = [];

  if (Array.isArray(navigatorLike?.languages)) {
    candidates.push(...navigatorLike.languages);
  }

  if (typeof navigatorLike?.language === 'string') {
    candidates.push(navigatorLike.language);
  }

  for (const candidate of candidates) {
    const matched = matchSupportedLocale(candidate);
    if (matched) {
      return matched;
    }
  }

  return fallback;
}

export function resolveInitialLocale(options = {}) {
  const fallback = resolveFallbackLocale(options.fallbackLocale);
  const storedLocale = readStoredLocale(options.storageTarget);

  if (storedLocale) {
    return storedLocale;
  }

  return resolveNavigatorLocale(options.navigatorLike, { fallbackLocale: fallback });
}

export function interpolateMessage(template, params = {}) {
  return String(template || '').replace(/\{([^{}]+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token]);
    }

    return match;
  });
}

export function translate(key, params = {}, options = {}) {
  const catalog = options.messages || messages;
  const locale = resolveLocale(options.locale, { fallbackLocale: options.fallbackLocale });
  const fallback = resolveFallbackLocale(options.fallbackLocale);
  const template =
    readMessageValue(locale, key, catalog) ||
    (locale !== fallback ? readMessageValue(fallback, key, catalog) : '');

  if (!template) {
    return key;
  }

  return interpolateMessage(template, params);
}

export function createI18n(options = {}) {
  const catalog = options.messages || messages;
  const storageTarget = options.storageTarget ?? options.window;
  const navigatorLike = options.navigatorLike ?? options.navigator ?? options.window?.navigator;
  const availableLocales = Object.freeze(getAvailableLocaleDefinitions(catalog));
  const currentLocale = ref(
    resolveInitialLocale({
      storageTarget,
      navigatorLike,
      fallbackLocale: options.fallbackLocale,
    })
  );

  const api = {
    locale: readonly(currentLocale),
    availableLocales,
    t(key, params = {}, translateOptions = {}) {
      return translate(key, params, {
        locale: translateOptions.locale ?? currentLocale.value,
        fallbackLocale: translateOptions.fallbackLocale ?? options.fallbackLocale,
        messages: catalog,
      });
    },
    setLocale(nextLocale, setLocaleOptions = {}) {
      const resolved = resolveLocale(nextLocale, { fallbackLocale: setLocaleOptions.fallbackLocale ?? options.fallbackLocale });
      currentLocale.value = resolved;

      if (setLocaleOptions.persist !== false) {
        persistStoredLocale(resolved, storageTarget);
      }

      return resolved;
    },
    getLocaleDefinition(code = currentLocale.value) {
      return getLocaleDefinition(resolveLocale(code, { fallbackLocale: options.fallbackLocale }));
    },
    install(app) {
      app.provide(I18N_SYMBOL, api);
      app.config.globalProperties.$t = api.t;
      app.config.globalProperties.$i18n = api;
    },
  };

  return api;
}

export function useI18n() {
  const i18n = inject(I18N_SYMBOL, null);

  if (!i18n) {
    throw new Error('I18n instance not found. Call app.use(createI18n()) before using useI18n().');
  }

  return i18n;
}
