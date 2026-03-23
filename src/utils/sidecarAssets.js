import { buildGatewayAssetUrl, publicGatewayOptions } from './gateway';
import { normalizeSubtitleManifest, subtitleCatalogStatus } from './subtitles';
import { createDefaultVideoInfo, normalizeVideoInfo } from './videoInfo';

export const posterAssetFileName = 'cover.webp';
export const avatarAssetFileName = 'avatar.jpg';
const videoInfoAssetFileName = 'info.json';
const htmlContentTypePattern = /\btext\/html\b/i;
const sidecarBlobCache = new Map();
const sidecarVideoInfoCache = new Map();
const sidecarSubtitleManifestCache = new Map();
const inflightSidecarRequests = new Map();

export function buildSidecarGatewayCandidates(primaryGateway = '', candidateGateways = []) {
  const orderedCandidates = [];
  const seen = new Set();

  [primaryGateway, ...candidateGateways, ...publicGatewayOptions.map((gateway) => gateway.url)].forEach((gateway) => {
    const normalizedGateway = normalizeString(gateway);
    if (!normalizedGateway || seen.has(normalizedGateway)) {
      return;
    }

    seen.add(normalizedGateway);
    orderedCandidates.push(normalizedGateway);
  });

  return orderedCandidates;
}

export function readCachedSidecarObjectUrl(cid, assetPath) {
  return sidecarBlobCache.get(createSidecarCacheKey(cid, assetPath))?.objectUrl || '';
}

export function readCachedVideoInfo(cid) {
  const cachedValue = sidecarVideoInfoCache.get(createVideoInfoCacheKey(cid));
  return cachedValue ? { ...cachedValue } : null;
}

export function readCachedSubtitleCatalog(cid, primaryGateway = '', candidateGateways = []) {
  const cacheKey = createSubtitleManifestCacheKey(cid);
  const cachedManifest = sidecarSubtitleManifestCache.get(cacheKey);

  if (!cachedManifest) {
    return null;
  }

  return {
    status: cachedManifest.status,
    tracks: buildResolvedSubtitleTracks(cachedManifest, cid, primaryGateway, candidateGateways),
  };
}

export async function loadPosterUrlWithFallback(cid, primaryGateway = '', candidateGateways = [], options = {}) {
  return loadBlobSidecarUrlWithFallback(cid, posterAssetFileName, primaryGateway, candidateGateways, options);
}

export async function loadAvatarUrlWithFallback(cid, primaryGateway = '', candidateGateways = [], options = {}) {
  return loadBlobSidecarUrlWithFallback(cid, avatarAssetFileName, primaryGateway, candidateGateways, options);
}

export async function loadVideoInfoWithFallback(cid, primaryGateway = '', candidateGateways = [], options = {}) {
  const normalizedCid = normalizeString(cid);
  if (!normalizedCid) {
    return createDefaultVideoInfo();
  }

  const cacheKey = createVideoInfoCacheKey(normalizedCid);
  const cachedValue = sidecarVideoInfoCache.get(cacheKey);
  if (cachedValue) {
    return { ...cachedValue };
  }

  return runSidecarRequest(`info:${normalizedCid}`, async () => {
    const gateways = buildSidecarGatewayCandidates(primaryGateway, candidateGateways);

    for (const gateway of gateways) {
      const assetUrl = buildGatewayAssetUrl(gateway, normalizedCid, videoInfoAssetFileName);
      const payload = await fetchJsonSidecarAsset(assetUrl, options);
      if (!payload) {
        continue;
      }

      const normalizedInfo = normalizeVideoInfo(payload);
      sidecarVideoInfoCache.set(cacheKey, normalizedInfo);
      return { ...normalizedInfo };
    }

    return createDefaultVideoInfo();
  });
}

export async function loadSubtitleCatalogWithFallback(cid, primaryGateway = '', candidateGateways = [], options = {}) {
  const normalizedCid = normalizeString(cid);
  if (!normalizedCid) {
    return {
      status: subtitleCatalogStatus.error,
      tracks: [],
    };
  }

  const cacheKey = createSubtitleManifestCacheKey(normalizedCid);
  const cachedManifest = sidecarSubtitleManifestCache.get(cacheKey);

  if (cachedManifest) {
    return {
      status: cachedManifest.status,
      tracks: await materializeSubtitleTracks(cachedManifest, normalizedCid, primaryGateway, candidateGateways, options),
    };
  }

  return runSidecarRequest(`subtitle-manifest:${normalizedCid}`, async () => {
    const gateways = buildSidecarGatewayCandidates(primaryGateway, candidateGateways);
    let sawMissingManifest = false;

    for (const gateway of gateways) {
      const assetUrl = buildGatewayAssetUrl(gateway, normalizedCid, 'subtitles.json');
      const response = await fetchJsonSidecarResponse(assetUrl, options);

      if (response.status === 'missing') {
        sawMissingManifest = true;
        continue;
      }

      if (response.status !== 'ok') {
        continue;
      }

      const cachedEntry = {
        status: subtitleCatalogStatus.ready,
        resolvedGateway: gateway,
        tracks: cloneManifestTracks(normalizeSubtitleManifest(response.payload)),
      };
      sidecarSubtitleManifestCache.set(cacheKey, cachedEntry);

      return {
        status: cachedEntry.status,
        tracks: await materializeSubtitleTracks(cachedEntry, normalizedCid, primaryGateway, candidateGateways, options),
      };
    }

    if (sawMissingManifest) {
      return {
        status: subtitleCatalogStatus.ready,
        tracks: [],
      };
    }

    return {
      status: subtitleCatalogStatus.error,
      tracks: [],
    };
  });
}

export function resetSidecarSessionCache(options = {}) {
  const revokeObjectURL = options.revokeObjectURL ?? globalThis.URL?.revokeObjectURL?.bind(globalThis.URL);

  if (typeof revokeObjectURL === 'function') {
    sidecarBlobCache.forEach(({ objectUrl }) => {
      if (normalizeString(objectUrl).startsWith('blob:')) {
        revokeObjectURL(objectUrl);
      }
    });
  }

  sidecarBlobCache.clear();
  sidecarVideoInfoCache.clear();
  sidecarSubtitleManifestCache.clear();
  inflightSidecarRequests.clear();
}

async function loadBlobSidecarUrlWithFallback(cid, assetPath, primaryGateway = '', candidateGateways = [], options = {}) {
  const normalizedCid = normalizeString(cid);
  const normalizedAssetPath = normalizeString(assetPath);

  if (!normalizedCid || !normalizedAssetPath) {
    return '';
  }

  const cacheKey = createSidecarCacheKey(normalizedCid, normalizedAssetPath);
  const cachedValue = sidecarBlobCache.get(cacheKey);
  if (cachedValue?.objectUrl) {
    return cachedValue.objectUrl;
  }

  return runSidecarRequest(`blob:${cacheKey}`, async () => {
    const gateways = buildSidecarGatewayCandidates(primaryGateway, candidateGateways);

    for (const gateway of gateways) {
      const assetUrl = buildGatewayAssetUrl(gateway, normalizedCid, normalizedAssetPath);
      const objectUrl = await fetchBlobSidecarAsset(assetUrl, options);
      if (!objectUrl) {
        continue;
      }

      sidecarBlobCache.set(cacheKey, {
        objectUrl,
        gateway,
      });
      return objectUrl;
    }

    return '';
  });
}

function buildResolvedSubtitleTracks(cachedManifest, cid, primaryGateway = '', candidateGateways = [], options = {}) {
  const gateways = buildSidecarGatewayCandidates(primaryGateway, [
    cachedManifest?.resolvedGateway || '',
    ...candidateGateways,
  ]);
  const fallbackGateway = cachedManifest?.resolvedGateway || gateways[0] || '';

  return cachedManifest.tracks.map((track, index) => {
    const objectUrl = readCachedSidecarObjectUrl(cid, track.path);
    const fallbackUrl = buildGatewayAssetUrl(fallbackGateway, cid, track.path);

    return {
      lang: track.lang,
      label: track.label,
      src: objectUrl || fallbackUrl,
      path: track.path,
      fileName: extractFileName(track.path),
      order: normalizeTrackOrder(track.order, index),
      source: 'remote',
    };
  }).filter((track) => track.src);
}

async function materializeSubtitleTracks(cachedManifest, cid, primaryGateway = '', candidateGateways = [], options = {}) {
  const gateways = buildSidecarGatewayCandidates(primaryGateway, [
    cachedManifest?.resolvedGateway || '',
    ...candidateGateways,
  ]);
  const fallbackGateway = cachedManifest?.resolvedGateway || gateways[0] || '';

  const resolvedTracks = await Promise.all(
    cachedManifest.tracks.map(async (track, index) => {
      const objectUrl =
        readCachedSidecarObjectUrl(cid, track.path) ||
        (await loadBlobSidecarUrlWithFallback(cid, track.path, primaryGateway, [cachedManifest?.resolvedGateway || '', ...candidateGateways], options));
      const fallbackUrl = buildGatewayAssetUrl(fallbackGateway, cid, track.path);

      return {
        lang: track.lang,
        label: track.label,
        src: objectUrl || fallbackUrl,
        path: track.path,
        fileName: extractFileName(track.path),
        order: normalizeTrackOrder(track.order, index),
        source: 'remote',
      };
    })
  );

  return resolvedTracks.filter((track) => track.src);
}

async function fetchBlobSidecarAsset(assetUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const createObjectURL = options.createObjectURL ?? globalThis.URL?.createObjectURL?.bind(globalThis.URL);
  const BlobImpl = options.BlobImpl ?? globalThis.Blob;

  if (typeof fetchImpl !== 'function') {
    return '';
  }

  try {
    const response = await fetchImpl(assetUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'default',
    });

    if (!response?.ok) {
      return '';
    }

    const contentType = response.headers?.get?.('content-type') || '';
    if (htmlContentTypePattern.test(contentType)) {
      return '';
    }

    if (typeof createObjectURL !== 'function') {
      return assetUrl;
    }

    const blob =
      typeof response.blob === 'function'
        ? await response.blob()
        : new BlobImpl([await response.text()], { type: contentType || '' });

    return createObjectURL(blob);
  } catch (_) {
    return '';
  }
}

async function fetchJsonSidecarAsset(assetUrl, options = {}) {
  const response = await fetchJsonSidecarResponse(assetUrl, options);
  return response.status === 'ok' ? response.payload : null;
}

async function fetchJsonSidecarResponse(assetUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    return {
      status: 'failed',
      payload: null,
    };
  }

  try {
    const response = await fetchImpl(assetUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'default',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
      },
    });

    if (!response?.ok) {
      return {
        status: response?.status === 404 ? 'missing' : 'failed',
        payload: null,
      };
    }

    const contentType = response.headers?.get?.('content-type') || '';
    if (htmlContentTypePattern.test(contentType)) {
      return {
        status: 'failed',
        payload: null,
      };
    }

    return {
      status: 'ok',
      payload: await response.json(),
    };
  } catch (_) {
    return {
      status: 'failed',
      payload: null,
    };
  }
}

function runSidecarRequest(key, factory) {
  if (inflightSidecarRequests.has(key)) {
    return inflightSidecarRequests.get(key);
  }

  const request = Promise.resolve()
    .then(factory)
    .finally(() => {
      inflightSidecarRequests.delete(key);
    });

  inflightSidecarRequests.set(key, request);
  return request;
}

function cloneManifestTracks(tracks = []) {
  return tracks.map((track) => ({
    lang: track.lang,
    label: track.label,
    path: track.path,
    order: track.order,
  }));
}

function createSidecarCacheKey(cid, assetPath) {
  const normalizedCid = normalizeString(cid);
  const normalizedAssetPath = normalizeString(assetPath);
  return normalizedCid && normalizedAssetPath ? `${normalizedCid}:${normalizedAssetPath}` : '';
}

function createVideoInfoCacheKey(cid) {
  const normalizedCid = normalizeString(cid);
  return normalizedCid ? `${normalizedCid}:${videoInfoAssetFileName}` : '';
}

function createSubtitleManifestCacheKey(cid) {
  const normalizedCid = normalizeString(cid);
  return normalizedCid ? `${normalizedCid}:subtitles.json` : '';
}

function normalizeTrackOrder(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function extractFileName(assetPath) {
  const normalizedAssetPath = normalizeString(assetPath);
  if (!normalizedAssetPath) {
    return '';
  }

  const segments = normalizedAssetPath.split('/');
  return segments[segments.length - 1] || normalizedAssetPath;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
