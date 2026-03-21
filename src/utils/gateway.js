export const gatewayStorageKey = 'ipfs-hls-selected-gateway';
export const customGatewayStorageKey = 'ipfs-hls-custom-gateway';
export const gatewayProbeTimeoutMs = 5000;
export const gatewayRateLimitBackoffMs = 30 * 60 * 1000;
export const gatewayProbeSegmentSampleCount = 3;
export const gatewayProbePlaybackRateThreshold = 1.2;
export const gatewayProbeSmoothPlaybackRateThreshold = 1.8;
const disabledGatewayHostnames = new Set(['gateway.pinata.cloud']);
export const publicGatewayOptions = [
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
  const normalized = normalizeHostname(hostname);

  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '::1') return true;
  if (normalized.startsWith('127.')) return true;
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

export function isDisabledGatewayInput(input, options = {}) {
  const { defaultProtocol = 'https:' } = options;
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return false;

  const candidate =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `${defaultProtocol}//${trimmed.replace(/^\/\//, '')}`;

  try {
    return disabledGatewayHostnames.has(normalizeHostname(new URL(candidate).hostname));
  } catch (_) {
    return false;
  }
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

  if (disabledGatewayHostnames.has(normalizeHostname(parsed.hostname))) {
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
    onProgress = null,
    cacheMode = 'no-store',
    segmentSampleCount = gatewayProbeSegmentSampleCount,
    playbackRateThreshold = gatewayProbePlaybackRateThreshold,
    startTimeSeconds = 0,
  } = options;
  const playlistUrl = buildGatewayIndexUrl(gatewayUrl, cid);

  if (!playlistUrl || typeof fetchImpl !== 'function') {
    return {
      state: 'failed',
      detail: '無法建立 gateway 檢查請求',
      durationMs: null,
      httpStatus: null,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
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
    const playlistResponse = await fetchGatewayTextResource(playlistUrl, fetchImpl, controller.signal, cacheMode);
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
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    }));

    const playlistText = await readTextResponse(playlistResponse);
    const parsedPlaylist = parseHlsPlaylist(playlistText, playlistUrl);
    let segmentEntries = parsedPlaylist.segmentEntries;

    if (!segmentEntries.length) {
      const variantPlaylists = orderVariantPlaylistsByBandwidth(parsedPlaylist.variantPlaylists);

      for (const variantPlaylist of variantPlaylists) {
        phase = 'media';
        const variantResponse = await fetchGatewayTextResource(
          variantPlaylist.url,
          fetchImpl,
          controller.signal,
          cacheMode
        );
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
        segmentEntries = parseHlsPlaylist(variantText, variantPlaylist.url).segmentEntries;
        if (segmentEntries.length) {
          break;
        }
      }
    }

    if (!segmentEntries.length) {
      return {
        state: 'degraded',
        detail: '已找到 index.m3u8，但播放清單內找不到可驗證的媒體片段',
        durationMs: Math.max(0, Math.round(nowFn() - startedAt)),
        httpStatus: playlistResponse.status,
        retryAfterMs: null,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      };
    }

    phase = 'segment';
    const segmentSamples = selectSegmentSamplesAroundTime(segmentEntries, segmentSampleCount, startTimeSeconds);
    let httpStatus = playlistResponse.status;
    let completedSampleCount = 0;
    let sampledBytes = 0;
    let sampledDurationSeconds = 0;

    try {
      const sampleResults = await Promise.all(
        segmentSamples.map(async (segmentSample) => {
          const segmentResponse = await fetchGatewayMediaResource(
            segmentSample.url,
            fetchImpl,
            controller.signal,
            cacheMode
          );
          if (!segmentResponse?.ok) {
            throw new ProbeHttpError(segmentResponse);
          }

          const bytes = await readMediaProbeBytes(segmentResponse);
          httpStatus = segmentResponse.status;
          completedSampleCount += 1;
          sampledBytes += bytes;
          sampledDurationSeconds += Number.isFinite(segmentSample.durationSeconds) ? segmentSample.durationSeconds : 0;

          emitProbeProgress(onProgress, () =>
            buildSegmentProbeProgress({
              nowFn,
              startedAt,
              httpStatus: segmentResponse.status,
              completedSampleCount,
              sampleSegmentCount: segmentSamples.length,
              sampledBytes,
              sampledDurationSeconds,
            })
          );

          return {
            status: segmentResponse.status,
          };
        })
      );

      if (sampleResults.length) {
        httpStatus = sampleResults[sampleResults.length - 1].status;
      }
    } catch (error) {
      if (error instanceof ProbeHttpError) {
        return buildProbeFailureResult(
          error.response,
          Math.max(0, Math.round(nowFn() - startedAt)),
          '已找到 index.m3u8，但前幾個片段不可用',
          {
            defaultState: 'degraded',
            forbiddenDetail: '已找到 index.m3u8，但前幾個片段拒絕存取',
            timeoutDetail: '已找到 index.m3u8，但前幾個片段來源逾時',
          }
        );
      }

      throw error;
    }

    const durationMs = Math.max(0, Math.round(nowFn() - startedAt));
    const throughputMbps = calculateThroughputMbps(sampledBytes, durationMs);
    const playbackRate = calculatePlaybackRate(sampledDurationSeconds, durationMs);

    if (playbackRate != null && playbackRate < playbackRateThreshold) {
      return {
        state: 'playlist_ready',
        detail: formatSegmentProbeDetail(segmentSamples.length, startTimeSeconds, 'slow'),
        durationMs,
        httpStatus,
        retryAfterMs: null,
        throughputMbps,
        playbackRate,
        sampleSegmentCount: segmentSamples.length,
        completedSampleCount,
      };
    }

    return {
      state: 'ready',
      detail: formatSegmentProbeDetail(segmentSamples.length, startTimeSeconds, 'ready'),
      durationMs,
      httpStatus,
      retryAfterMs: null,
      throughputMbps,
      playbackRate,
      sampleSegmentCount: segmentSamples.length,
      completedSampleCount,
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
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
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
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function selectSegmentSamplesAroundTime(segmentEntries, segmentSampleCount, startTimeSeconds = 0) {
  const normalizedSampleCount = Math.max(1, Math.floor(segmentSampleCount || 1));

  if (!Array.isArray(segmentEntries) || segmentEntries.length === 0) {
    return [];
  }

  if (!(startTimeSeconds > 0)) {
    return segmentEntries.slice(0, normalizedSampleCount);
  }

  let elapsedSeconds = 0;
  let targetIndex = 0;

  for (let index = 0; index < segmentEntries.length; index += 1) {
    const segmentDuration = Number.isFinite(segmentEntries[index]?.durationSeconds) ? segmentEntries[index].durationSeconds : 0;
    const segmentEnd = elapsedSeconds + segmentDuration;

    if (startTimeSeconds < segmentEnd || index === segmentEntries.length - 1) {
      targetIndex = index;
      break;
    }

    elapsedSeconds = segmentEnd;
  }

  const maxStartIndex = Math.max(0, segmentEntries.length - normalizedSampleCount);
  const startIndex = Math.min(targetIndex, maxStartIndex);

  return segmentEntries.slice(startIndex, startIndex + normalizedSampleCount);
}

function formatSegmentProbeDetail(sampleCount, startTimeSeconds, mode) {
  const segmentScope =
    startTimeSeconds > 0 ? `目前播放位置附近 ${sampleCount} 個片段` : `前 ${sampleCount} 個片段`;

  if (mode === 'slow') {
    return `已預載${segmentScope}，但下載速度偏慢`;
  }

  return `已預載${segmentScope}，可開始播放`;
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
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    };
  }

  if (status && [301, 302, 307, 308].includes(status)) {
    return {
      state: 'redirected',
      detail: `重新導向 (HTTP ${status})`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    };
  }

  if (status === 504) {
    return {
      state: defaultState,
      detail: `${timeoutDetail} (HTTP 504)`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    };
  }

  if (status === 403) {
    return {
      state: defaultState,
      detail: `${forbiddenDetail} (HTTP 403)`,
      durationMs,
      httpStatus: status,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    };
  }

  return {
    state: defaultState,
    detail: `${fallbackDetail} (HTTP ${status ?? 'ERR'})`,
    durationMs,
    httpStatus: status,
    retryAfterMs: null,
    throughputMbps: null,
    playbackRate: null,
    sampleSegmentCount: 0,
    completedSampleCount: 0,
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
  const variantPlaylists = [];
  const segmentEntries = [];
  const lines = String(playlistText || '').split(/\r?\n/);
  let expectsVariantUri = false;
  let pendingVariantBandwidth = null;
  let pendingSegmentDuration = null;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const initSegmentUrl = parsePlaylistTagUri(line, '#EXT-X-MAP');
    if (initSegmentUrl) {
      const resolvedInitSegmentUrl = resolvePlaylistResourceUrl(baseUrl, initSegmentUrl);
      if (resolvedInitSegmentUrl) {
        segmentEntries.push({
          url: resolvedInitSegmentUrl,
          durationSeconds: 0,
        });
      }
    }

    if (line.startsWith('#EXT-X-STREAM-INF')) {
      expectsVariantUri = true;
      pendingVariantBandwidth = parseBandwidth(line);
      return;
    }

    if (line.startsWith('#EXTINF')) {
      pendingSegmentDuration = parseExtinfDuration(line);
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
      variantPlaylists.push({
        url: resolvedUrl,
        bandwidth: pendingVariantBandwidth,
      });
      expectsVariantUri = false;
      pendingVariantBandwidth = null;
      return;
    }

    segmentEntries.push({
      url: resolvedUrl,
      durationSeconds: pendingSegmentDuration,
    });
    pendingSegmentDuration = null;
  });

  return {
    variantPlaylists: dedupeVariantPlaylists(variantPlaylists),
    segmentEntries: dedupeSegmentEntries(segmentEntries),
  };
}

function dedupeVariantPlaylists(playlists) {
  const seen = new Set();

  return playlists.filter((playlist) => {
    if (!playlist?.url || seen.has(playlist.url)) {
      return false;
    }

    seen.add(playlist.url);
    return true;
  });
}

function dedupeSegmentEntries(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    if (!entry?.url || seen.has(entry.url)) {
      return false;
    }

    seen.add(entry.url);
    return true;
  });
}

function parsePlaylistTagUri(line, tagPrefix) {
  if (!line.startsWith(tagPrefix)) {
    return '';
  }

  const match = line.match(/(?:^|,)URI="([^"]+)"/i);
  return match?.[1] || '';
}

function parseBandwidth(line) {
  const match = line.match(/(?:^|,)BANDWIDTH=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseExtinfDuration(line) {
  const match = line.match(/^#EXTINF:([0-9]+(?:\.[0-9]+)?)/i);
  return match ? Number.parseFloat(match[1]) : null;
}

function orderVariantPlaylistsByBandwidth(variantPlaylists) {
  return [...variantPlaylists].sort((left, right) => {
    const leftBandwidth = Number.isFinite(left?.bandwidth) ? left.bandwidth : Number.MAX_SAFE_INTEGER;
    const rightBandwidth = Number.isFinite(right?.bandwidth) ? right.bandwidth : Number.MAX_SAFE_INTEGER;

    if (leftBandwidth !== rightBandwidth) {
      return leftBandwidth - rightBandwidth;
    }

    return String(left?.url || '').localeCompare(String(right?.url || ''));
  });
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

function fetchGatewayTextResource(url, fetchImpl, signal, cacheMode = 'no-store') {
  return fetchImpl(url, {
    method: 'GET',
    cache: cacheMode,
    headers: {
      Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain;q=0.8, */*;q=0.1',
    },
    signal,
  });
}

function fetchGatewayMediaResource(url, fetchImpl, signal, cacheMode = 'no-store') {
  return fetchImpl(url, {
    method: 'GET',
    cache: cacheMode,
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

async function readMediaProbeBytes(response) {
  const reader = response?.body?.getReader?.();
  if (reader) {
    try {
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        totalBytes += value?.byteLength ?? value?.length ?? 0;
      }

      return totalBytes;
    } finally {
      try {
        await reader.cancel();
      } catch (_) {
        // Ignore cancellation failures from already-closed streams.
      }
    }
  }

  if (typeof response?.arrayBuffer === 'function') {
    const buffer = await response.arrayBuffer();
    return buffer?.byteLength ?? 0;
  }

  return 0;
}

function buildSegmentProbeProgress({
  nowFn,
  startedAt,
  httpStatus,
  completedSampleCount,
  sampleSegmentCount,
  sampledBytes,
  sampledDurationSeconds,
}) {
  const durationMs = Math.max(0, Math.round(nowFn() - startedAt));

  return {
    state: 'probing',
    detail: `已預載 ${completedSampleCount}/${sampleSegmentCount} 個片段`,
    durationMs,
    httpStatus,
    retryAfterMs: null,
    throughputMbps: calculateThroughputMbps(sampledBytes, durationMs),
    playbackRate: calculatePlaybackRate(sampledDurationSeconds, durationMs),
    sampleSegmentCount,
    completedSampleCount,
  };
}

function calculateThroughputMbps(sampledBytes, durationMs) {
  if (!(sampledBytes > 0) || !(durationMs > 0)) {
    return null;
  }

  return roundMetric((sampledBytes * 8) / (durationMs / 1000) / 1000000);
}

function calculatePlaybackRate(sampledDurationSeconds, durationMs) {
  if (!(sampledDurationSeconds > 0) || !(durationMs > 0)) {
    return null;
  }

  return roundMetric(sampledDurationSeconds / (durationMs / 1000));
}

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

class ProbeHttpError extends Error {
  constructor(response) {
    super(`probe http error (${response?.status ?? 'ERR'})`);
    this.name = 'ProbeHttpError';
    this.response = response;
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

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
}
