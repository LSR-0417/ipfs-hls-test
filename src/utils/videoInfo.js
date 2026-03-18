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
  const normalizedBaseUrl = normalizeString(baseUrl);
  if (!normalizedBaseUrl) return '';

  return `${normalizedBaseUrl.endsWith('/') ? normalizedBaseUrl : `${normalizedBaseUrl}/`}info.json`;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
