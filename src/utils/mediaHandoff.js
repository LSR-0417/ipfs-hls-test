import { buildGatewayAssetUrl } from './gateway';

export const mediaHandoffQualityModeAuto = 'auto';
export const mediaHandoffQualityModeManual = 'manual';
export const mediaHandoffQualityModeUnknown = 'unknown';
export const mediaHandoffRequestKindManifest = 'manifest';
export const mediaHandoffRequestKindSegment = 'segment';
export const mediaHandoffRequestKindUnknown = 'unknown';

export function buildMediaHandoffQualitySnapshot(qualityLevels) {
  const normalizedLevels = collectNormalizedQualityLevels(qualityLevels);

  if (normalizedLevels.length === 0) {
    return {
      mode: mediaHandoffQualityModeUnknown,
      activeHeight: null,
      lockedHeight: null,
      allHeights: [],
      enabledHeights: [],
    };
  }

  const allHeights = dedupeHeights(normalizedLevels.map((level) => level.height));
  const enabledHeights = dedupeHeights(normalizedLevels.filter((level) => level.enabled).map((level) => level.height));
  const activeHeight = resolveActiveQualityHeight(qualityLevels, normalizedLevels);
  const mode =
    enabledHeights.length > 0 && enabledHeights.length < allHeights.length
      ? mediaHandoffQualityModeManual
      : mediaHandoffQualityModeAuto;
  const lockedHeight =
    mode === mediaHandoffQualityModeManual
      ? resolveManualLockedHeight(enabledHeights, activeHeight)
      : Number.isFinite(activeHeight)
        ? activeHeight
        : null;

  return {
    mode,
    activeHeight: Number.isFinite(activeHeight) ? activeHeight : null,
    lockedHeight: Number.isFinite(lockedHeight) ? lockedHeight : null,
    allHeights,
    enabledHeights,
  };
}

export function selectMediaHandoffLockedHeight(snapshot, availableVariantHeights = []) {
  const preferredHeight =
    snapshot?.mode === mediaHandoffQualityModeManual ? snapshot?.lockedHeight : snapshot?.activeHeight;

  if (!Number.isFinite(preferredHeight)) {
    return null;
  }

  const normalizedHeights = dedupeHeights(availableVariantHeights);
  if (normalizedHeights.length === 0) {
    return preferredHeight;
  }

  if (normalizedHeights.includes(preferredHeight)) {
    return preferredHeight;
  }

  const lowerHeights = normalizedHeights.filter((height) => height < preferredHeight);
  if (lowerHeights.length > 0) {
    return lowerHeights[lowerHeights.length - 1];
  }

  const higherHeights = normalizedHeights.filter((height) => height > preferredHeight);
  return higherHeights[0] || preferredHeight;
}

export function applyQualityLevelHeightLock(qualityLevels, targetHeight) {
  if (!qualityLevels || !Number.isFinite(qualityLevels.length)) {
    return false;
  }

  const unlockToAuto = targetHeight === mediaHandoffQualityModeAuto;
  let matched = false;

  for (let index = 0; index < qualityLevels.length; index += 1) {
    const level = qualityLevels[index];
    if (!level) {
      continue;
    }

    const levelHeight = getQualityLevelHeight(level);
    const shouldEnable = unlockToAuto ? true : levelHeight === targetHeight;

    if (!unlockToAuto && levelHeight === targetHeight) {
      matched = true;
    }

    level.enabled = shouldEnable;
  }

  return unlockToAuto ? true : matched;
}

export function rewriteMediaHandoffRequestUri(uri, options = {}) {
  const { cid = '', gateway = '' } = options;
  const resolvedAsset = extractMediaAssetDescriptor(uri, cid);

  if (!resolvedAsset || !gateway) {
    return '';
  }

  const baseUri = buildGatewayAssetUrl(gateway, cid, resolvedAsset.assetPath);
  if (!baseUri) {
    return '';
  }

  return `${baseUri}${resolvedAsset.search}${resolvedAsset.hash}`;
}

export function classifyMediaHandoffRequestKind(uri) {
  try {
    const { pathname } = new URL(uri);
    return /\.m3u8?$/i.test(pathname) ? mediaHandoffRequestKindManifest : mediaHandoffRequestKindSegment;
  } catch (_) {
    return mediaHandoffRequestKindUnknown;
  }
}

export function isSuccessfulMediaHandoffSegmentResponse(request, error, response, options = {}) {
  if (error) {
    return false;
  }

  const requestUri =
    typeof request?.uri === 'string' && request.uri
      ? request.uri
      : typeof request?.url === 'string' && request.url
        ? request.url
        : '';

  if (!requestUri || classifyMediaHandoffRequestKind(requestUri) !== mediaHandoffRequestKindSegment) {
    return false;
  }

  const rewrittenUri = rewriteMediaHandoffRequestUri(requestUri, options);
  if (!rewrittenUri || normalizeComparableUrl(rewrittenUri) !== normalizeComparableUrl(requestUri)) {
    return false;
  }

  const status = Number(response?.statusCode ?? response?.status ?? request?.statusCode ?? request?.status);
  return Number.isFinite(status) && status >= 200 && status < 400;
}

export function clearRecoverableMediaPlaylistExclusions(playlists = []) {
  let clearedCount = 0;

  playlists.forEach((playlist) => {
    if (!playlist || typeof playlist !== 'object') {
      return;
    }

    const isNonUsableExclusion =
      playlist.excludeUntil === Infinity && playlist.lastExcludeReason_ === 'non-usable';

    if (isNonUsableExclusion) {
      return;
    }

    if (typeof playlist.excludeUntil !== 'undefined') {
      delete playlist.excludeUntil;
      clearedCount += 1;
    }

    if (playlist.lastExcludeReason_) {
      delete playlist.lastExcludeReason_;
    }
  });

  return clearedCount;
}

export function resumeMediaHandoffPlayback(player, options = {}) {
  const { shouldAutoplay = false } = options;
  const vhs = player?.tech?.()?.vhs;
  const playlistController = vhs?.playlistController_ || vhs?.playlistController;

  if (!playlistController) {
    return {
      didClearError: false,
      reincludedPlaylistCount: 0,
      didResumeLoading: false,
    };
  }

  const mainPlaylists =
    playlistController?.mainPlaylistLoader_?.main?.playlists || vhs?.playlists?.main?.playlists || [];
  const reincludedPlaylistCount = clearRecoverableMediaPlaylistExclusions(mainPlaylists);
  const didClearError = clearPlayerError(player);

  if (playlistController.mainPlaylistLoader_) {
    playlistController.mainPlaylistLoader_.error = null;
    playlistController.mainPlaylistLoader_.load?.();
  }

  playlistController.error = null;
  playlistController.mainSegmentLoader_?.error?.(null);
  playlistController.audioSegmentLoader_?.error?.(null);
  playlistController.subtitleSegmentLoader_?.error?.(null);

  if (shouldAutoplay && typeof playlistController.play === 'function') {
    playlistController.play();
    return {
      didClearError,
      reincludedPlaylistCount,
      didResumeLoading: true,
    };
  }

  playlistController.load?.();
  return {
    didClearError,
    reincludedPlaylistCount,
    didResumeLoading: true,
  };
}

function collectNormalizedQualityLevels(qualityLevels) {
  const levels = [];
  const total = Number.isFinite(qualityLevels?.length) ? qualityLevels.length : 0;

  for (let index = 0; index < total; index += 1) {
    const level = qualityLevels[index];
    const height = getQualityLevelHeight(level);

    if (!Number.isFinite(height)) {
      continue;
    }

    levels.push({
      index,
      height,
      enabled: level?.enabled !== false,
    });
  }

  return levels;
}

function resolveActiveQualityHeight(qualityLevels, normalizedLevels) {
  const selectedIndex = Number.isFinite(qualityLevels?.selectedIndex) ? qualityLevels.selectedIndex : -1;
  if (selectedIndex >= 0 && selectedIndex < (qualityLevels?.length || 0)) {
    const selectedHeight = getQualityLevelHeight(qualityLevels[selectedIndex]);
    if (Number.isFinite(selectedHeight)) {
      return selectedHeight;
    }
  }

  const enabledLevels = normalizedLevels.filter((level) => level.enabled);
  if (enabledLevels.length > 0) {
    return enabledLevels[enabledLevels.length - 1].height;
  }

  return normalizedLevels[normalizedLevels.length - 1]?.height ?? null;
}

function resolveManualLockedHeight(enabledHeights, activeHeight) {
  if (Number.isFinite(activeHeight) && enabledHeights.includes(activeHeight)) {
    return activeHeight;
  }

  return enabledHeights[enabledHeights.length - 1] ?? null;
}

function dedupeHeights(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort((left, right) => left - right);
}

function getQualityLevelHeight(level) {
  if (!level) {
    return Number.NaN;
  }

  const width = Number.isFinite(level.width) ? level.width : Number.NaN;
  const height = Number.isFinite(level.height) ? level.height : Number.NaN;

  if (!Number.isFinite(width) && !Number.isFinite(height)) {
    return Number.NaN;
  }

  if (!Number.isFinite(width)) {
    return height;
  }

  if (!Number.isFinite(height)) {
    return width;
  }

  return Math.min(width, height);
}

function extractMediaAssetDescriptor(uri, cid) {
  const normalizedCid = typeof cid === 'string' ? cid.trim() : '';
  if (!normalizedCid) {
    return null;
  }

  try {
    const parsed = new URL(uri);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ipfsIndex = segments.findIndex((segment) => segment === 'ipfs');

    if (ipfsIndex < 0 || segments[ipfsIndex + 1] !== normalizedCid) {
      return null;
    }

    return {
      assetPath: segments.slice(ipfsIndex + 2).join('/'),
      search: parsed.search || '',
      hash: parsed.hash || '',
    };
  } catch (_) {
    return null;
  }
}

function normalizeComparableUrl(uri) {
  try {
    return new URL(uri).toString();
  } catch (_) {
    return '';
  }
}

function clearPlayerError(player) {
  if (!player || typeof player.error !== 'function') {
    return false;
  }

  const currentError = player.error();
  if (!currentError) {
    return false;
  }

  player.error(null);
  return true;
}
