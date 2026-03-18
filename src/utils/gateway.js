export const gatewayStorageKey = 'ipfs-hls-selected-gateway';
export const customGatewayStorageKey = 'ipfs-hls-custom-gateway';
export const gatewayProbeTimeoutMs = 5000;
export const gatewayRateLimitBackoffMs = 30 * 60 * 1000;
export const gatewayProbeSegmentSampleCount = 3;
export const gatewayProbeReadyThresholdMs = 2000;
export const publicGatewayOptions = [
  {
    id: 'pinata',
    label: 'Pinata',
    desc: 'Reliable and usually fast',
    url: 'https://gateway.pinata.cloud/ipfs/',
  },
  {
    id: 'dweb',
    label: 'dweb.link',
    desc: 'Official IPFS gateway',
    url: 'https://dweb.link/ipfs/',
  },
  {
    id: 'ipfsio',
    label: 'ipfs.io',
    desc: 'Standard public gateway',
    url: 'https://ipfs.io/ipfs/',
  },
];
export const defaultPublicGateway = publicGatewayOptions[0].url;
export const defaultLocalGateway = 'http://127.0.0.1:8080/ipfs/';

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

export function readStoredGateway(target) {
  return readStoredValue(gatewayStorageKey, target);
}

export function persistGateway(gateway, target) {
  persistStoredValue(gatewayStorageKey, gateway, target);
}

export function readStoredCustomGateway(target) {
  return readStoredValue(customGatewayStorageKey, target);
}

export function persistCustomGateway(gateway, target) {
  persistStoredValue(customGatewayStorageKey, gateway, target);
}

function readStoredValue(key, target) {
  const storage = resolveStorage(target);
  if (!storage) return '';

  try {
    const value = storage.getItem(key);
    return typeof value === 'string' ? value.trim() : '';
  } catch (_) {
    return '';
  }
}

function persistStoredValue(key, value, target) {
  const storage = resolveStorage(target);
  if (!storage) return;

  const normalized = typeof value === 'string' ? value.trim() : '';

  try {
    if (normalized) {
      storage.setItem(key, normalized);
      return;
    }

    if (typeof storage.removeItem === 'function') {
      storage.removeItem(key);
    }
  } catch (_) {
    // ignore storage errors
  }
}

export function isPrivateHostname(hostname) {
  const normalized = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '::1') return true;
  if (normalized.startsWith('127.')) return true;
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

export function normalizeGatewayUrl(input, options = {}) {
  const { allowPrivateHosts = false, defaultProtocol = 'https:' } = options;
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return '';

  const candidate =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `${defaultProtocol}//${trimmed.replace(/^\/\//, '')}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (_) {
    return '';
  }

  const isPrivate = isPrivateHostname(parsed.hostname);
  const isHttps = parsed.protocol === 'https:';
  const isHttp = parsed.protocol === 'http:';

  if (isPrivate) {
    if (!allowPrivateHosts || (!isHttp && !isHttps)) {
      return '';
    }
  } else if (!isHttps) {
    return '';
  }

  const pathname = normalizeGatewayPath(parsed.pathname);
  if (!pathname) return '';

  parsed.username = '';
  parsed.password = '';
  parsed.pathname = pathname;
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString();
}

export function getDefaultGateway(options = {}) {
  return options.allowPrivateHosts ? defaultLocalGateway : defaultPublicGateway;
}

export function buildGatewayAssetUrl(gatewayUrl, cid, assetPath = '') {
  const normalizedGateway = typeof gatewayUrl === 'string' ? gatewayUrl.trim() : '';
  const normalizedCid = typeof cid === 'string' ? cid.trim() : '';
  const normalizedAssetPath = typeof assetPath === 'string' ? assetPath.trim().replace(/^\/+/, '') : '';

  if (!normalizedGateway || !normalizedCid) return '';

  if (!normalizedAssetPath) {
    return `${normalizedGateway}${normalizedCid}/`;
  }

  return `${normalizedGateway}${normalizedCid}/${normalizedAssetPath}`;
}

export function buildGatewayIndexUrl(gatewayUrl, cid) {
  return buildGatewayAssetUrl(gatewayUrl, cid, 'index.m3u8');
}

export async function probeGatewayAvailability(gatewayUrl, cid, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = gatewayProbeTimeoutMs,
    nowFn = defaultNow,
    readyThresholdMs = gatewayProbeReadyThresholdMs,
    onProgress = null,
  } = options;
  const playlistUrl = buildGatewayIndexUrl(gatewayUrl, cid);

  if (!playlistUrl || typeof fetchImpl !== 'function') {
    return {
      state: 'failed',
      detail: '無法建立 gateway 檢查請求',
      durationMs: null,
      httpStatus: null,
      retryAfterMs: null,
    };
  }

  const controller = new AbortController();
  const startedAt = nowFn();
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  let phase = 'index';

  try {
    const playlistResponse = await fetchGatewayTextResource(playlistUrl, fetchImpl, controller.signal);
    if (!playlistResponse?.ok) {
      return buildProbeFailureResult(
        playlistResponse,
        Math.max(0, Math.round(nowFn() - startedAt)),
        '找不到 index.m3u8'
      );
    }

    emitProbeProgress(onProgress, () => ({
      state: 'playlist_ready',
      detail: '已找到 index.m3u8，正在驗證片段',
      durationMs: Math.max(0, Math.round(nowFn() - startedAt)),
      httpStatus: playlistResponse.status,
      retryAfterMs: null,
    }));

    const playlistText = await readTextResponse(playlistResponse);
    const parsedPlaylist = parseHlsPlaylist(playlistText, playlistUrl);
    let segmentUrls = parsedPlaylist.segmentUrls;

    if (!segmentUrls.length) {
      const variantUrls = parsedPlaylist.variantPlaylistUrls;

      for (const variantUrl of variantUrls) {
        phase = 'media';
        const variantResponse = await fetchGatewayTextResource(variantUrl, fetchImpl, controller.signal);
        if (!variantResponse?.ok) {
          return buildProbeFailureResult(
            variantResponse,
            Math.max(0, Math.round(nowFn() - startedAt)),
            '已找到 index.m3u8，但子播放清單不可用',
            {
              defaultState: 'degraded',
              forbiddenDetail: '已找到 index.m3u8，但子播放清單拒絕存取',
              timeoutDetail: '已找到 index.m3u8，但子播放清單來源逾時',
            }
          );
        }

        const variantText = await readTextResponse(variantResponse);
        segmentUrls = parseHlsPlaylist(variantText, variantUrl).segmentUrls;
        if (segmentUrls.length) {
          break;
        }
      }
    }

    if (!segmentUrls.length) {
      return {
        state: 'degraded',
        detail: '已找到 index.m3u8，但播放清單內找不到可驗證的媒體片段',
        durationMs: Math.max(0, Math.round(nowFn() - startedAt)),
        httpStatus: playlistResponse.status,
        retryAfterMs: null,
      };
    }

    phase = 'segment';
    const segmentSampleUrls = segmentUrls.slice(0, gatewayProbeSegmentSampleCount);
    let httpStatus = playlistResponse.status;

    for (const segmentUrl of segmentSampleUrls) {
      const segmentResponse = await fetchGatewayMediaResource(segmentUrl, fetchImpl, controller.signal);
      if (!segmentResponse?.ok) {
        return buildProbeFailureResult(
          segmentResponse,
          Math.max(0, Math.round(nowFn() - startedAt)),
          '已找到 index.m3u8，但前幾個片段不可用',
          {
            defaultState: 'degraded',
            forbiddenDetail: '已找到 index.m3u8，但前幾個片段拒絕存取',
            timeoutDetail: '已找到 index.m3u8，但前幾個片段來源逾時',
          }
        );
      }

      httpStatus = segmentResponse.status;
      await readMediaProbeChunk(segmentResponse);
    }

    const durationMs = Math.max(0, Math.round(nowFn() - startedAt));
    if (readyThresholdMs > 0 && durationMs > readyThresholdMs) {
      return {
        state: 'playlist_ready',
        detail: `已找到 index.m3u8，前 ${segmentSampleUrls.length} 個片段可取但偏慢`,
        durationMs,
        httpStatus,
        retryAfterMs: null,
      };
    }

    return {
      state: 'ready',
      detail: `已快速驗證前 ${segmentSampleUrls.length} 個片段`,
      durationMs,
      httpStatus,
      retryAfterMs: null,
    };
  } catch (error) {
    const durationMs = Math.max(0, Math.round(nowFn() - startedAt));
    if (error?.name === 'AbortError') {
      return {
        state: phase === 'index' ? 'failed' : 'degraded',
        detail:
          phase === 'segment'
            ? '已找到 index.m3u8，但片段驗證逾時'
            : phase === 'media'
              ? '已找到 index.m3u8，但子播放清單驗證逾時'
              : '逾時，找不到 index.m3u8',
        durationMs,
        httpStatus: null,
        retryAfterMs: null,
      };
    }

    return {
      state: phase === 'index' ? 'failed' : 'degraded',
      detail:
        phase === 'segment'
          ? '已找到 index.m3u8，但無法取得媒體片段'
          : phase === 'media'
            ? '已找到 index.m3u8，但無法取得子播放清單'
            : '無法取得 index.m3u8',
      durationMs,
      httpStatus: null,
      retryAfterMs: null,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildProbeFailureResult(response, durationMs, fallbackDetail, options = {}) {
  const {
    defaultState = 'failed',
    forbiddenDetail = '拒絕存取',
    timeoutDetail = '來源逾時',
  } = options;
  const status = Number.isFinite(response?.status) ? response.status : null;

  if (status === 429) {
    return {
      state: 'rate_limited',
      detail: '暫時限流 (HTTP 429)',
      durationMs,
      httpStatus: status,
      retryAfterMs: parseRetryAfterHeader(response) ?? gatewayRateLimitBackoffMs,
    };
  }

  if (status && [301, 302, 307, 308].includes(status)) {
    return {
      state: 'redirected',
      detail: `重新導向 (HTTP ${status})`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
    };
  }

  if (status === 504) {
    return {
      state: defaultState,
      detail: `${timeoutDetail} (HTTP 504)`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
    };
  }

  if (status === 403) {
    return {
      state: defaultState,
      detail: `${forbiddenDetail} (HTTP 403)`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
    };
  }

  return {
    state: defaultState,
    detail: `${fallbackDetail} (HTTP ${status ?? 'ERR'})`,
    durationMs,
    httpStatus: status,
    retryAfterMs: null,
  };
}

function emitProbeProgress(onProgress, getPayload) {
  if (typeof onProgress !== 'function') {
    return;
  }

  try {
    onProgress(getPayload());
  } catch (_) {
    // Ignore observer errors so probe completion still reflects the fetch result.
  }
}

function parseHlsPlaylist(playlistText, baseUrl) {
  const variantPlaylistUrls = [];
  const segmentUrls = [];
  const lines = String(playlistText || '').split(/\r?\n/);
  let expectsVariantUri = false;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const initSegmentUrl = parsePlaylistTagUri(line, '#EXT-X-MAP');
    if (initSegmentUrl) {
      const resolvedInitSegmentUrl = resolvePlaylistResourceUrl(baseUrl, initSegmentUrl);
      if (resolvedInitSegmentUrl) {
        segmentUrls.push(resolvedInitSegmentUrl);
      }
    }

    if (line.startsWith('#EXT-X-STREAM-INF')) {
      expectsVariantUri = true;
      return;
    }

    if (line.startsWith('#')) {
      return;
    }

    const resolvedUrl = resolvePlaylistResourceUrl(baseUrl, line);
    if (!resolvedUrl) {
      expectsVariantUri = false;
      return;
    }

    if (expectsVariantUri || isPlaylistLikeUrl(resolvedUrl)) {
      variantPlaylistUrls.push(resolvedUrl);
      expectsVariantUri = false;
      return;
    }

    segmentUrls.push(resolvedUrl);
  });

  return {
    variantPlaylistUrls: dedupeUrls(variantPlaylistUrls),
    segmentUrls: dedupeUrls(segmentUrls),
  };
}

function dedupeUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function parsePlaylistTagUri(line, tagPrefix) {
  if (!line.startsWith(tagPrefix)) {
    return '';
  }

  const match = line.match(/(?:^|,)URI="([^"]+)"/i);
  return match?.[1] || '';
}

function resolvePlaylistResourceUrl(baseUrl, resourcePath) {
  try {
    return new URL(resourcePath, baseUrl).toString();
  } catch (_) {
    return '';
  }
}

function isPlaylistLikeUrl(resourceUrl) {
  try {
    const { pathname } = new URL(resourceUrl);
    return /\.m3u8?$/i.test(pathname);
  } catch (_) {
    return false;
  }
}

function fetchGatewayTextResource(url, fetchImpl, signal) {
  return fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain;q=0.8, */*;q=0.1',
    },
    signal,
  });
}

function fetchGatewayMediaResource(url, fetchImpl, signal) {
  return fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'video/mp2t, video/mp4, application/octet-stream;q=0.8, */*;q=0.1',
    },
    signal,
  });
}

async function readTextResponse(response) {
  if (typeof response?.text === 'function') {
    return response.text();
  }

  return '';
}

async function readMediaProbeChunk(response) {
  const reader = response?.body?.getReader?.();
  if (reader) {
    try {
      await reader.read();
    } finally {
      try {
        await reader.cancel();
      } catch (_) {
        // Ignore cancellation failures from already-closed streams.
      }
    }
    return;
  }

  if (typeof response?.arrayBuffer === 'function') {
    await response.arrayBuffer();
  }
}

function parseRetryAfterHeader(response) {
  const rawValue = getHeaderValue(response?.headers, 'retry-after');
  if (!rawValue) return null;

  const seconds = Number.parseInt(rawValue, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateValue = Date.parse(rawValue);
  if (Number.isNaN(dateValue)) {
    return null;
  }

  return Math.max(0, dateValue - Date.now());
}

function getHeaderValue(headers, name) {
  if (!headers || typeof headers.get !== 'function') {
    return '';
  }

  return headers.get(name) || headers.get(name.toLowerCase()) || '';
}

function normalizeGatewayPath(pathname) {
  if (!pathname || pathname === '/') return '/ipfs/';
  if (pathname.endsWith('/ipfs')) return `${pathname}/`;
  if (pathname.endsWith('/ipfs/')) return pathname;
  return '';
}

function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}
