const defaultVideoInfo = Object.freeze({
  id: '',
  title: '',
  uploader: '',
  channelId: '',
  uploadDate: '',
  durationString: '',
  description: '',
  tags: [],
  categories: [],
  resolution: '',
  fps: null,
});

const descriptionUrlPattern = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;
const descriptionHashtagPattern = /(^|[\s([{<"'`「『（【])#([\p{L}\p{N}_][\p{L}\p{N}\p{M}_-]*)/gu;
const draftFormFieldNames = Object.freeze([
  'id',
  'title',
  'uploader',
  'channelId',
  'uploadDate',
  'description',
  'tags',
  'categories',
]);

export function createDefaultVideoInfo() {
  return {
    ...defaultVideoInfo,
    tags: [],
    categories: [],
  };
}

export function normalizeVideoInfo(payload = {}) {
  return {
    id: normalizeString(payload.id),
    title: normalizeString(payload.title),
    uploader: normalizeString(payload.uploader),
    channelId: normalizeString(payload.channel_id),
    uploadDate: normalizeString(payload.upload_date),
    durationString: normalizeString(payload.duration_string),
    description: normalizeString(payload.description),
    tags: normalizeStringArray(payload.tags),
    categories: normalizeStringArray(payload.categories),
    resolution: normalizeString(payload.resolution),
    fps: normalizeFps(payload.fps),
  };
}

export function createVideoInfoDraftFormState(videoInfo = createDefaultVideoInfo()) {
  const source = videoInfo && typeof videoInfo === 'object' ? videoInfo : createDefaultVideoInfo();

  return {
    id: source.id || '',
    title: source.title || '',
    uploader: source.uploader || '',
    channelId: source.channelId || '',
    uploadDate: formatUploadDate(source.uploadDate || ''),
    description: source.description || '',
    tags: Array.isArray(source.tags) ? source.tags.join(', ') : '',
    categories: Array.isArray(source.categories) ? source.categories.join(', ') : '',
  };
}

export function createVideoInfoDraftFormSnapshot(formState = {}) {
  return {
    id: normalizeString(formState.id),
    title: normalizeString(formState.title),
    uploader: normalizeString(formState.uploader),
    channelId: normalizeString(formState.channelId),
    uploadDate: normalizeString(formState.uploadDate),
    description: normalizeString(formState.description),
    tags: normalizeString(formState.tags),
    categories: normalizeString(formState.categories),
  };
}

export function isVideoInfoDraftFormPristine(formState = {}, lastSyncedSnapshot = null) {
  if (!lastSyncedSnapshot || typeof lastSyncedSnapshot !== 'object') {
    return false;
  }

  const currentSnapshot = createVideoInfoDraftFormSnapshot(formState);
  return draftFormFieldNames.every((fieldName) => currentSnapshot[fieldName] === lastSyncedSnapshot[fieldName]);
}

export function buildInfoJsonPayload(payload = {}) {
  const normalized = normalizeVideoInfo({
    id: payload.id,
    title: payload.title,
    uploader: payload.uploader,
    channel_id: payload.channelId ?? payload.channel_id,
    upload_date: normalizeInfoJsonUploadDate(payload.uploadDate ?? payload.upload_date),
    duration_string: payload.durationString ?? payload.duration_string,
    description: payload.description,
    tags: payload.tags,
    categories: payload.categories,
    resolution: payload.resolution,
    fps: payload.fps,
  });

  const result = {};

  if (normalized.id) result.id = normalized.id;
  if (normalized.title) result.title = normalized.title;
  if (normalized.uploader) result.uploader = normalized.uploader;
  if (normalized.channelId) result.channel_id = normalized.channelId;
  if (normalized.uploadDate) result.upload_date = normalized.uploadDate;
  if (normalized.durationString) result.duration_string = normalized.durationString;
  if (normalized.description) result.description = normalized.description;
  if (normalized.tags.length > 0) result.tags = normalized.tags;
  if (normalized.categories.length > 0) result.categories = normalized.categories;
  if (normalized.resolution) result.resolution = normalized.resolution;
  if (normalized.fps) result.fps = normalized.fps;

  return result;
}

export function stringifyInfoJson(payload = {}, options = {}) {
  const indent = Number.isInteger(options.indent) && options.indent >= 0 ? options.indent : 2;
  return `${JSON.stringify(buildInfoJsonPayload(payload), null, indent)}\n`;
}

export function buildSidecarAssetUrl(baseUrl, assetPath) {
  const normalizedBaseUrl = normalizeString(baseUrl);
  const normalizedAssetPath = normalizeAssetPath(assetPath);

  if (!normalizedBaseUrl || !normalizedAssetPath) return '';

  return `${normalizedBaseUrl.endsWith('/') ? normalizedBaseUrl : `${normalizedBaseUrl}/`}${normalizedAssetPath}`;
}

export function formatUploadDate(uploadDate) {
  const normalized = normalizeString(uploadDate);
  if (!/^\d{8}$/.test(normalized)) return normalized;

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
}

export function formatUploadDateTooltip(uploadDate) {
  const uploadAt = parseUploadDate(uploadDate);
  if (!uploadAt) return '';

  return `${uploadAt.getFullYear()}年${uploadAt.getMonth() + 1}月${uploadAt.getDate()}日`;
}

export function formatRelativeUploadTime(uploadDate, options = {}) {
  const uploadAt = parseUploadDate(uploadDate);
  if (!uploadAt) return '';

  const nowValue = options.now ?? Date.now();
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const diffMs = Math.max(0, now.getTime() - uploadAt.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))} 分鐘前`;
  }

  if (diffMs < dayMs) {
    return `${Math.max(1, Math.floor(diffMs / hourMs))} 小時前`;
  }

  if (diffMs < monthMs) {
    return `${Math.max(1, Math.floor(diffMs / dayMs))} 天前`;
  }

  if (diffMs < yearMs) {
    return `${Math.max(1, Math.floor(diffMs / monthMs))} 個月前`;
  }

  return `${Math.max(1, Math.floor(diffMs / yearMs))} 年前`;
}

export function linkifyDescription(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source) return [];

  const segments = [];
  let lastIndex = 0;

  for (const match of source.matchAll(descriptionUrlPattern)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        text: source.slice(lastIndex, matchIndex),
      });
    }

    const { urlText, trailingText } = splitUrlToken(rawMatch);

    if (urlText) {
      segments.push({
        type: 'link',
        text: urlText,
        href: normalizeDescriptionHref(urlText),
      });
    } else {
      segments.push({
        type: 'text',
        text: rawMatch,
      });
    }

    if (trailingText) {
      segments.push({
        type: 'text',
        text: trailingText,
      });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < source.length) {
    segments.push({
      type: 'text',
      text: source.slice(lastIndex),
    });
  }

  return mergeDescriptionSegments(segments);
}

export function extractDescriptionHashtags(text, options = {}) {
  const source = typeof text === 'string' ? text : '';
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3;
  const hashtags = [];
  const seen = new Set();

  for (const match of source.matchAll(descriptionHashtagPattern)) {
    const tag = String(match[2] || '').trim();
    const normalizedTag = tag.toLowerCase();

    if (!tag || seen.has(normalizedTag)) continue;

    seen.add(normalizedTag);
    hashtags.push(tag);

    if (hashtags.length >= limit) break;
  }

  return hashtags;
}

export async function fetchVideoInfo(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const infoUrl = buildInfoUrl(baseUrl);

  if (!infoUrl) {
    return createDefaultVideoInfo();
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable');
  }

  const response = await fetchImpl(infoUrl, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
    },
  });

  if (!response?.ok) {
    throw new Error(`metadata request failed (${response?.status ?? 'unknown'})`);
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('metadata request returned HTML');
  }

  return normalizeVideoInfo(await response.json());
}

function buildInfoUrl(baseUrl) {
  return buildSidecarAssetUrl(baseUrl, 'info.json');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitUrlToken(value) {
  let urlText = String(value || '');
  let trailingText = '';

  while (urlText) {
    const lastChar = urlText.slice(-1);

    if (/[.,!?;:，。！？；：'"`]/.test(lastChar)) {
      trailingText = `${lastChar}${trailingText}`;
      urlText = urlText.slice(0, -1);
      continue;
    }

    if (/[)\]}]/.test(lastChar) && hasMoreClosingDelimiters(urlText, lastChar)) {
      trailingText = `${lastChar}${trailingText}`;
      urlText = urlText.slice(0, -1);
      continue;
    }

    break;
  }

  return {
    urlText,
    trailingText,
  };
}

function hasMoreClosingDelimiters(value, closer) {
  const opener = { ')': '(', ']': '[', '}': '{' }[closer];
  if (!opener) return false;

  return countCharacters(value, closer) > countCharacters(value, opener);
}

function countCharacters(value, character) {
  return Array.from(String(value || '')).filter((item) => item === character).length;
}

function normalizeDescriptionHref(value) {
  const urlText = String(value || '');
  if (urlText.toLowerCase().startsWith('www.')) {
    return `https://${urlText}`;
  }

  return urlText;
}

function mergeDescriptionSegments(segments) {
  return segments
    .filter((segment) => segment.text)
    .reduce((merged, segment) => {
      const previousSegment = merged[merged.length - 1];

      if (previousSegment?.type === 'text' && segment.type === 'text') {
        previousSegment.text += segment.text;
        return merged;
      }

      merged.push({ ...segment });
      return merged;
    }, []);
}

function parseUploadDate(value) {
  const normalized = normalizeString(value);

  if (/^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    const parsed = new Date(year, month, day);

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeInfoJsonUploadDate(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return '';
  }

  if (/^\d{8}$/.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }

  return normalized;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => normalizeString(value))
    .filter((value) => value.length > 0);
}

function normalizeFps(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeAssetPath(value) {
  const normalized = normalizeString(value).replace(/^\/+/, '');

  if (!normalized || normalized.includes('://')) {
    return '';
  }

  return normalized;
}
