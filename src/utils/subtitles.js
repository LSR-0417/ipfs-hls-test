import { buildSidecarAssetUrl } from './videoInfo';

export const subtitleManifestFileName = 'subtitles.json';
export const subtitlePreferenceStorageKey = 'ipfs-hls-subtitle-preference';
export const subtitleCatalogStatus = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  error: 'error',
});
const localSubtitleSource = 'local';
const remoteSubtitleSource = 'remote';
const defaultImportedSubtitleLanguage = 'und';

const defaultSubtitlePreference = Object.freeze({
  mode: 'showing',
  primaryLang: '',
  secondaryLang: '',
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

export async function fetchSubtitleCatalog(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const manifestUrl = buildSidecarAssetUrl(baseUrl, subtitleManifestFileName);

  if (!manifestUrl || typeof fetchImpl !== 'function') {
    return {
      status: subtitleCatalogStatus.error,
      tracks: [],
    };
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
      return {
        status: response?.status === 404 ? subtitleCatalogStatus.ready : subtitleCatalogStatus.error,
        tracks: [],
      };
    }

    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('text/html')) {
      return {
        status: subtitleCatalogStatus.error,
        tracks: [],
      };
    }

    return {
      status: subtitleCatalogStatus.ready,
      tracks: normalizeSubtitleManifest(await response.json()),
    };
  } catch (_) {
    return {
      status: subtitleCatalogStatus.error,
      tracks: [],
    };
  }
}

export async function fetchSubtitleManifest(baseUrl, options = {}) {
  const catalog = await fetchSubtitleCatalog(baseUrl, options);
  return catalog.tracks;
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
      const path = normalizeAssetPath(subtitle?.path);
      const src = buildSidecarAssetUrl(baseUrl, path);
      const order = normalizeOrder(subtitle?.order, index);

      if (!lang || !src || !path) {
        return null;
      }

      return {
        lang,
        label,
        src,
        path,
        fileName: extractFileName(path),
        order,
        source: remoteSubtitleSource,
      };
    })
    .filter((subtitle) => subtitle !== null)
    .sort((left, right) => left.order - right.order);
}

export function mergeSubtitleTracks(remoteSubtitles = [], importedSubtitles = []) {
  const normalizedImported = importedSubtitles
    .map((subtitle, index) => normalizePlayerSubtitleTrack(subtitle, index, localSubtitleSource))
    .filter((subtitle) => subtitle !== null)
    .sort((left, right) => left.order - right.order);
  const importedLangs = new Set(normalizedImported.map((subtitle) => normalizeLocale(subtitle.lang)));
  const normalizedRemote = remoteSubtitles
    .map((subtitle, index) => normalizePlayerSubtitleTrack(subtitle, index, remoteSubtitleSource))
    .filter((subtitle) => subtitle !== null)
    .filter((subtitle) => !importedLangs.has(normalizeLocale(subtitle.lang)));

  return [...normalizedRemote, ...normalizedImported].sort((left, right) => left.order - right.order);
}

export async function createImportedSubtitleTrack(file, options = {}, dependencies = {}) {
  const readText = typeof file?.text === 'function' ? file.text.bind(file) : null;
  if (!readText) {
    throw new Error('無法讀取字幕檔。');
  }

  const createObjectURL =
    dependencies.createObjectURL ?? globalThis.URL?.createObjectURL?.bind(globalThis.URL);
  const BlobImpl = dependencies.BlobImpl ?? globalThis.Blob;

  if (typeof createObjectURL !== 'function' || typeof BlobImpl !== 'function') {
    throw new Error('目前環境無法建立字幕預覽。');
  }

  const fileName = normalizeString(file?.name) || 'subtitle.vtt';
  const rawText = normalizeImportedText(await readText());
  if (!rawText.trim()) {
    throw new Error('字幕檔內容是空的。');
  }

  const format = detectImportedSubtitleFormat(fileName, rawText);
  if (!format) {
    throw new Error('目前只支援 .vtt 與 .srt 字幕檔。');
  }

  const trackText = format === 'srt' ? convertSrtToVtt(rawText) : normalizeWebVttText(rawText);
  const lang = normalizeString(options.lang) || inferSubtitleLanguage(fileName) || defaultImportedSubtitleLanguage;
  const label = normalizeString(options.label) || defaultImportedSubtitleLabel(lang, fileName);
  const order = normalizeOrder(options.order, 0);
  const src = createObjectURL(
    new BlobImpl([trackText], {
      type: 'text/vtt;charset=utf-8',
    })
  );

  return {
    id: createImportedSubtitleId(lang, fileName),
    lang,
    label,
    src,
    order,
    source: localSubtitleSource,
    fileName: ensureVttExtension(fileName),
  };
}

export async function downloadSubtitleTrack(track, options = {}) {
  const href = normalizeString(track?.src);
  if (!href) {
    throw new Error('沒有可下載的字幕來源。');
  }

  const documentLike = options.documentLike ?? globalThis.document;
  if (!documentLike?.body || typeof documentLike.createElement !== 'function') {
    throw new Error('目前環境無法下載字幕檔。');
  }

  const fileName = resolveSubtitleDownloadFileName(track);
  if (normalizeString(track?.source) === localSubtitleSource || href.startsWith('blob:')) {
    triggerSubtitleDownload(documentLike, href, fileName);
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const createObjectURL =
    options.createObjectURL ?? globalThis.URL?.createObjectURL?.bind(globalThis.URL);
  const revokeObjectURL =
    options.revokeObjectURL ?? globalThis.URL?.revokeObjectURL?.bind(globalThis.URL);
  const BlobImpl = options.BlobImpl ?? globalThis.Blob;

  if (typeof fetchImpl !== 'function' || typeof createObjectURL !== 'function') {
    throw new Error('目前環境無法下載字幕檔。');
  }

  const response = await fetchImpl(href, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
  });

  if (!response?.ok) {
    throw new Error(`字幕下載失敗 (${response?.status ?? 'unknown'})`);
  }

  const blob =
    typeof response.blob === 'function'
      ? await response.blob()
      : new BlobImpl([await response.text()], { type: 'text/vtt;charset=utf-8' });
  const objectUrl = createObjectURL(blob);

  try {
    triggerSubtitleDownload(documentLike, objectUrl, fileName);
  } finally {
    scheduleObjectUrlRevoke(objectUrl, revokeObjectURL);
  }
}

export function revokeImportedSubtitleTracks(subtitles = [], urlLike = globalThis.URL) {
  if (!urlLike || typeof urlLike.revokeObjectURL !== 'function') {
    return;
  }

  subtitles.forEach((subtitle) => {
    if (normalizeString(subtitle?.source) !== localSubtitleSource) {
      return;
    }

    const href = normalizeString(subtitle?.src);
    if (href.startsWith('blob:')) {
      urlLike.revokeObjectURL(href);
    }
  });
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

  const matchedPrimaryLang =
    matchAvailableSubtitleLanguage(subtitles, normalizedPreference.primaryLang) ||
    choosePreferredSubtitleLanguage(subtitles, navigatorLike);
  const matchedSecondaryLang = resolveSecondarySubtitleLanguage(
    subtitles,
    normalizedPreference.secondaryLang,
    matchedPrimaryLang
  );

  return {
    mode: normalizedPreference.mode,
    primaryLang: matchedPrimaryLang,
    secondaryLang: matchedSecondaryLang,
  };
}

export function resolveToggledSubtitlePreference(preference, subtitles = [], navigatorLike = null, activeLang = '') {
  const reconciledPreference = reconcileSubtitlePreference(preference, subtitles, navigatorLike);
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return reconciledPreference;
  }

  const activeLanguages = normalizeActiveSubtitleLanguages(subtitles, activeLang);
  if (activeLanguages.length > 0) {
    return {
      mode: 'off',
      primaryLang: activeLanguages[0] || reconciledPreference.primaryLang,
      secondaryLang: activeLanguages[1] || reconciledPreference.secondaryLang,
    };
  }

  return {
    mode: 'showing',
    primaryLang: reconciledPreference.primaryLang || choosePreferredSubtitleLanguage(subtitles, navigatorLike),
    secondaryLang: reconciledPreference.secondaryLang,
  };
}

export function resolvePlayerControlledSubtitlePreference(
  preference,
  subtitles = [],
  navigatorLike = null,
  activeLang = ''
) {
  const reconciledPreference = reconcileSubtitlePreference(preference, subtitles, navigatorLike);
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return reconciledPreference;
  }

  const activeLanguages = normalizeActiveSubtitleLanguages(subtitles, activeLang);
  if (activeLanguages.length === 0) {
    return {
      mode: 'off',
      primaryLang: reconciledPreference.primaryLang,
      secondaryLang: reconciledPreference.secondaryLang,
    };
  }

  const nextPrimaryLang = activeLanguages[0] || reconciledPreference.primaryLang;
  const nextSecondaryLang = resolveSecondarySubtitleLanguage(
    subtitles,
    activeLanguages[1] || reconciledPreference.secondaryLang,
    nextPrimaryLang
  );

  return {
    mode: 'showing',
    primaryLang: nextPrimaryLang,
    secondaryLang: nextSecondaryLang,
  };
}

export function resolveDualSubtitleSwapControlState(preference, subtitles = [], navigatorLike = null) {
  const reconciledPreference = reconcileSubtitlePreference(preference, subtitles, navigatorLike);
  const hasConfiguredDualSubtitles = Boolean(reconciledPreference.primaryLang) && Boolean(reconciledPreference.secondaryLang);

  if (!hasConfiguredDualSubtitles) {
    return {
      visible: false,
      enabled: false,
      tooltip: '需要同時設定主字幕和副字幕',
    };
  }

  if (reconciledPreference.mode !== 'showing') {
    return {
      visible: true,
      enabled: false,
      tooltip: '字幕目前關閉，先開啟字幕',
    };
  }

  return {
    visible: true,
    enabled: true,
    tooltip: '切換主 / 副字幕',
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

  const englishFallback = matchAvailableSubtitleLanguage(subtitles, 'en');
  if (englishFallback) {
    return englishFallback;
  }

  return normalizeString(subtitles[0]?.lang);
}

export function convertSrtToVtt(text) {
  const normalized = normalizeImportedText(text).trim();
  if (!normalized) {
    throw new Error('字幕檔內容是空的。');
  }

  const cueBody = normalized
    .replace(
      /(^|\n)(\d{2}:\d{2}:\d{2}),(\d{3})(\s+-->\s+)(\d{2}:\d{2}:\d{2}),(\d{3})(.*)$/gm,
      (_, prefix, startSeconds, startMs, separator, endSeconds, endMs, trailing) =>
        `${prefix}${startSeconds}.${startMs}${separator}${endSeconds}.${endMs}${trailing}`
    )
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2}\.\d{3}\s+-->)/gm, '');

  return `WEBVTT\n\n${cueBody.endsWith('\n') ? cueBody : `${cueBody}\n`}`;
}

function normalizeSubtitlePreference(preference) {
  const legacyLang = normalizeString(preference?.primaryLang || preference?.lang);
  const secondaryLang = normalizeString(preference?.secondaryLang);

  return {
    mode: preference?.mode === 'showing' ? 'showing' : 'off',
    primaryLang: legacyLang,
    secondaryLang: normalizeLocale(secondaryLang) === normalizeLocale(legacyLang) ? '' : secondaryLang,
  };
}

function normalizePlayerSubtitleTrack(track, index, fallbackSource = '') {
  const lang = normalizeString(track?.lang);
  const src = normalizeString(track?.src);
  const label = normalizeString(track?.label) || defaultSubtitleLabel(lang);

  if (!lang || !src || !label) {
    return null;
  }

  const normalizedTrack = {
    ...track,
    lang,
    label,
    src,
    order: normalizeOrder(track?.order, index),
    source: normalizeString(track?.source) || fallbackSource,
  };

  if (normalizedTrack.path) {
    normalizedTrack.path = normalizeAssetPath(normalizedTrack.path);
  }

  if (!normalizedTrack.fileName) {
    normalizedTrack.fileName = resolveSubtitleDownloadFileName(normalizedTrack);
  }

  return normalizedTrack;
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

function defaultImportedSubtitleLabel(lang, fileName) {
  if (lang && lang !== defaultImportedSubtitleLanguage) {
    return `${defaultSubtitleLabel(lang)} (Local)`;
  }

  return stripFileExtension(fileName) || 'Local subtitle';
}

function normalizeActiveSubtitleLanguages(subtitles, activeLanguages) {
  const candidateLanguages = Array.isArray(activeLanguages) ? activeLanguages : [activeLanguages];
  const normalizedLanguages = [];

  candidateLanguages.forEach((language) => {
    const matchedLanguage = matchAvailableSubtitleLanguage(subtitles, language);
    if (!matchedLanguage) {
      return;
    }

    if (normalizedLanguages.some((value) => normalizeLocale(value) === normalizeLocale(matchedLanguage))) {
      return;
    }

    normalizedLanguages.push(matchedLanguage);
  });

  return normalizedLanguages.slice(0, 2);
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

function resolveSecondarySubtitleLanguage(subtitles, locale, primaryLang = '') {
  const matchedLanguage = matchAvailableSubtitleLanguage(subtitles, locale);
  if (!matchedLanguage) {
    return '';
  }

  return normalizeLocale(matchedLanguage) === normalizeLocale(primaryLang) ? '' : matchedLanguage;
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

function normalizeImportedText(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

function normalizeWebVttText(text) {
  const normalized = normalizeImportedText(text).trim();
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(normalized)) {
    throw new Error('字幕檔不是有效的 WebVTT 格式。');
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function detectImportedSubtitleFormat(fileName, text) {
  const extension = normalizeString(fileName).split('.').pop()?.toLowerCase() || '';
  if (extension === 'vtt') return 'vtt';
  if (extension === 'srt') return 'srt';
  if (/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(text.trim())) return 'vtt';
  if (/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(text)) return 'srt';
  return '';
}

function inferSubtitleLanguage(fileName) {
  const stem = stripFileExtension(fileName);
  if (!stem) return '';

  const candidates = [stem, ...stem.split(/[._]/).filter(Boolean)].reverse();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeString(candidate).replace(/_/g, '-');
    if (/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return '';
}

function createImportedSubtitleId(lang, fileName) {
  return `local:${normalizeLocale(lang) || defaultImportedSubtitleLanguage}:${Date.now()}:${stripFileExtension(fileName) || 'subtitle'}`;
}

function extractFileName(path) {
  const normalizedPath = normalizeAssetPath(path);
  if (!normalizedPath) {
    return '';
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  return segments.at(-1) || '';
}

function stripFileExtension(fileName) {
  const normalized = normalizeString(fileName);
  return normalized.replace(/\.[^.]+$/, '');
}

function ensureVttExtension(fileName) {
  const stem = stripFileExtension(fileName) || 'subtitle';
  return `${stem}.vtt`;
}

function resolveSubtitleDownloadFileName(track) {
  const fileName = normalizeString(track?.fileName);
  if (fileName) {
    return normalizeString(track?.source) === localSubtitleSource ? ensureVttExtension(fileName) : fileName;
  }

  const pathFileName = extractFileName(track?.path);
  if (pathFileName) {
    return pathFileName;
  }

  const src = normalizeString(track?.src);
  if (src) {
    try {
      const url = new URL(src, 'https://example.invalid');
      const candidate = extractFileName(url.pathname);
      if (candidate) {
        return candidate;
      }
    } catch (_) {
      // ignore malformed URLs and fall back below
    }
  }

  return ensureVttExtension(normalizeString(track?.lang) || 'subtitle');
}

function triggerSubtitleDownload(documentLike, href, fileName) {
  const link = documentLike.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  link.download = fileName;
  documentLike.body.appendChild(link);
  link.click();
  documentLike.body.removeChild(link);
}

function scheduleObjectUrlRevoke(href, revokeObjectURL) {
  if (typeof revokeObjectURL !== 'function') {
    return;
  }

  if (typeof globalThis.setTimeout === 'function') {
    globalThis.setTimeout(() => {
      revokeObjectURL(href);
    }, 0);
    return;
  }

  revokeObjectURL(href);
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
