import { buildSidecarAssetUrl } from './videoInfo';

export const subtitleManifestFileName = 'subtitles.json';
export const subtitlePreferenceStorageKey = 'ipfs-hls-subtitle-preference';

const defaultSubtitlePreference = Object.freeze({
  mode: 'off',
  lang: '',
});

const subtitleLabelMap = Object.freeze({
  en: 'English',
  'en-US': 'English',
  'en-GB': 'English',
  'zh-TW': '繁體中文',
  'zh-Hant': '繁體中文',
  'zh-CN': '簡體中文',
  'zh-Hans': '簡體中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
});

export function createDefaultSubtitlePreference() {
  return { ...defaultSubtitlePreference };
}

export async function fetchSubtitleManifest(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const manifestUrl = buildSidecarAssetUrl(baseUrl, subtitleManifestFileName);

  if (!manifestUrl || typeof fetchImpl !== 'function') {
    return [];
  }

  try {
    const response = await fetchImpl(manifestUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
      },
    });

    if (!response?.ok) {
      return [];
    }

    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('text/html')) {
      return [];
    }

    return normalizeSubtitleManifest(await response.json());
  } catch (_) {
    return [];
  }
}

export function normalizeSubtitleManifest(payload = {}) {
  const tracks = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.tracks)
      ? payload.tracks
      : Array.isArray(payload?.subtitles)
        ? payload.subtitles
        : [];

  return tracks
    .map((track, index) => normalizeSubtitleTrack(track, index))
    .filter((track) => track !== null)
    .sort((left, right) => left.order - right.order);
}

export function resolveSubtitleTracks(baseUrl, subtitles = []) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return [];

  return subtitles
    .map((subtitle, index) => {
      const lang = normalizeString(subtitle?.lang);
      const label = normalizeString(subtitle?.label) || defaultSubtitleLabel(lang);
      const src = buildSidecarAssetUrl(baseUrl, subtitle?.path);
      const order = normalizeOrder(subtitle?.order, index);

      if (!lang || !src) {
        return null;
      }

      return {
        lang,
        label,
        src,
        order,
      };
    })
    .filter((subtitle) => subtitle !== null)
    .sort((left, right) => left.order - right.order);
}

export function readStoredSubtitlePreference(target) {
  const storage = resolveStorage(target);
  if (!storage) return createDefaultSubtitlePreference();

  try {
    const value = storage.getItem(subtitlePreferenceStorageKey);
    if (!value) return createDefaultSubtitlePreference();

    return normalizeSubtitlePreference(JSON.parse(value));
  } catch (_) {
    return createDefaultSubtitlePreference();
  }
}

export function persistSubtitlePreference(preference, target) {
  const storage = resolveStorage(target);
  if (!storage) return;

  try {
    storage.setItem(subtitlePreferenceStorageKey, JSON.stringify(normalizeSubtitlePreference(preference)));
  } catch (_) {
    // ignore storage errors
  }
}

export function reconcileSubtitlePreference(preference, subtitles = [], navigatorLike = null) {
  const normalizedPreference = normalizeSubtitlePreference(preference);
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return normalizedPreference;
  }

  const matchedStoredLang = matchAvailableSubtitleLanguage(subtitles, normalizedPreference.lang);
  if (matchedStoredLang) {
    return {
      mode: normalizedPreference.mode,
      lang: matchedStoredLang,
    };
  }

  return {
    mode: normalizedPreference.mode,
    lang: choosePreferredSubtitleLanguage(subtitles, navigatorLike),
  };
}

export function resolveToggledSubtitlePreference(preference, subtitles = [], navigatorLike = null, activeLang = '') {
  const reconciledPreference = reconcileSubtitlePreference(preference, subtitles, navigatorLike);
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return reconciledPreference;
  }

  const matchedActiveLang = matchAvailableSubtitleLanguage(subtitles, activeLang);
  if (matchedActiveLang) {
    return {
      mode: 'off',
      lang: matchedActiveLang || reconciledPreference.lang,
    };
  }

  return {
    mode: 'showing',
    lang: reconciledPreference.lang || choosePreferredSubtitleLanguage(subtitles, navigatorLike),
  };
}

export function choosePreferredSubtitleLanguage(subtitles = [], navigatorLike = null) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return '';

  const locales = extractPreferredLocales(navigatorLike);

  for (const locale of locales) {
    const matched = matchAvailableSubtitleLanguage(subtitles, locale);
    if (matched) {
      return matched;
    }
  }

  return normalizeString(subtitles[0]?.lang);
}

function normalizeSubtitlePreference(preference) {
  return {
    mode: preference?.mode === 'showing' ? 'showing' : 'off',
    lang: normalizeString(preference?.lang),
  };
}

function normalizeSubtitleTrack(track, index) {
  const lang = normalizeString(track?.lang || track?.srclang || track?.code);
  const path = normalizeAssetPath(track?.path || track?.src || track?.file);

  if (!lang || !path) {
    return null;
  }

  return {
    lang,
    label: normalizeString(track?.label) || defaultSubtitleLabel(lang),
    path,
    order: normalizeOrder(track?.order, index),
  };
}

function defaultSubtitleLabel(lang) {
  return subtitleLabelMap[lang] || lang || 'Unknown';
}

function matchAvailableSubtitleLanguage(subtitles, locale) {
  const normalizedLocale = normalizeLocale(locale);
  if (!normalizedLocale) return '';

  const exactMatch = subtitles.find((subtitle) => normalizeLocale(subtitle?.lang) === normalizedLocale);
  if (exactMatch) {
    return normalizeString(exactMatch.lang);
  }

  const localeBase = localeBaseLanguage(normalizedLocale);
  if (!localeBase) return '';

  const baseMatch = subtitles.find((subtitle) => localeBaseLanguage(subtitle?.lang) === localeBase);
  return baseMatch ? normalizeString(baseMatch.lang) : '';
}

function extractPreferredLocales(navigatorLike) {
  const locales = [];

  if (Array.isArray(navigatorLike?.languages)) {
    locales.push(...navigatorLike.languages);
  }

  if (navigatorLike?.language) {
    locales.push(navigatorLike.language);
  }

  return locales
    .map((locale) => normalizeLocale(locale))
    .filter((locale, index, values) => locale && values.indexOf(locale) === index);
}

function normalizeLocale(value) {
  return normalizeString(value).replace(/_/g, '-').toLowerCase();
}

function localeBaseLanguage(value) {
  return normalizeLocale(value).split('-')[0] || '';
}

function normalizeAssetPath(value) {
  const normalized = normalizeString(value).replace(/^\/+/, '');

  if (!normalized || normalized.includes('://')) {
    return '';
  }

  return normalized;
}

function normalizeOrder(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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
