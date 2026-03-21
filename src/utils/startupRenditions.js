import { gatewayProbeSmoothPlaybackRateThreshold } from './gateway';

export const startupInitialRenditionCountSlow = 1;
export const startupInitialRenditionCountSmooth = 2;
export const startupInitialRenditionCountFast = 3;
export const startupInitialRenditionFastPlaybackRateThreshold = 3;

export function getStartupInitialRenditionCount(playbackRate) {
  if (!Number.isFinite(playbackRate)) {
    return startupInitialRenditionCountSlow;
  }

  if (playbackRate >= startupInitialRenditionFastPlaybackRateThreshold) {
    return startupInitialRenditionCountFast;
  }

  if (playbackRate >= gatewayProbeSmoothPlaybackRateThreshold) {
    return startupInitialRenditionCountSmooth;
  }

  return startupInitialRenditionCountSlow;
}

export function pickStartupInitialPlaylist(playlists, maxInitialRenditions, options = {}) {
  const { nowFn = Date.now } = options;
  const candidates = Array.isArray(playlists) ? playlists.filter((playlist) => isStartupSelectablePlaylist(playlist, nowFn)) : [];

  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort(compareStartupVariantEntries);
  return sorted[Math.min(normalizeVariantCount(maxInitialRenditions), sorted.length) - 1] || null;
}

export function buildQualityLevelPayload(qualityLevels) {
  const total = Number.isFinite(qualityLevels?.length) ? qualityLevels.length : 0;
  const levels = [];

  for (let index = 0; index < total; index += 1) {
    const level = qualityLevels[index];

    if (!level) {
      continue;
    }

    levels.push({
      id: level.id ?? index,
      label: formatQualityLevelLabel(level),
      width: firstFinite(level.width, 0),
      height: firstFinite(level.height, 0),
      bandwidth: Number.isFinite(level.bandwidth) ? level.bandwidth : null,
      enabled: level.enabled !== false,
    });
  }

  return levels.sort(compareStartupVariantEntries);
}

export function formatQualitySelectorLabel(qualityLevels) {
  const levels = buildQualityLevelPayload(qualityLevels);

  if (levels.length === 0) {
    return 'Auto';
  }

  const enabledLevels = levels.filter((level) => level.enabled);
  const selectedLabel = getSelectedQualityLevelLabel(qualityLevels);

  if (enabledLevels.length === 1) {
    return selectedLabel || enabledLevels[0].label || 'Auto';
  }

  if (selectedLabel) {
    return `Auto · ${selectedLabel}`;
  }

  return 'Auto';
}

export function compareStartupVariantEntries(left, right) {
  const leftBandwidth = resolveVariantBandwidth(left);
  const rightBandwidth = resolveVariantBandwidth(right);

  if (leftBandwidth !== rightBandwidth) {
    return leftBandwidth - rightBandwidth;
  }

  const leftPixels = resolveVariantPixels(left);
  const rightPixels = resolveVariantPixels(right);

  if (leftPixels !== rightPixels) {
    return leftPixels - rightPixels;
  }

  return String(resolveVariantIdentity(left)).localeCompare(String(resolveVariantIdentity(right)));
}

function normalizeVariantCount(value) {
  if (!Number.isFinite(value)) {
    return startupInitialRenditionCountSlow;
  }

  return Math.max(startupInitialRenditionCountSlow, Math.floor(value));
}

function isStartupSelectablePlaylist(playlist, nowFn) {
  if (!playlist) {
    return false;
  }

  const excludeUntil = playlist.excludeUntil;

  if (excludeUntil === Infinity) {
    return false;
  }

  if (Number.isFinite(excludeUntil) && excludeUntil > nowFn()) {
    return false;
  }

  return playlist.disabled !== true;
}

function resolveVariantBandwidth(entry) {
  const attributes = resolveVariantAttributes(entry);

  if (Number.isFinite(entry?.bandwidth)) {
    return entry.bandwidth;
  }

  if (Number.isFinite(attributes?.BANDWIDTH)) {
    return attributes.BANDWIDTH;
  }

  return Number.MAX_SAFE_INTEGER;
}

function resolveVariantPixels(entry) {
  const attributes = resolveVariantAttributes(entry);
  const resolution = attributes?.RESOLUTION;
  const width = firstFinite(entry?.width, resolution?.width);
  const height = firstFinite(entry?.height, resolution?.height);

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return Math.min(width, height);
  }

  return Number.MAX_SAFE_INTEGER;
}

function resolveVariantAttributes(entry) {
  if (entry?.attributes) {
    return entry.attributes;
  }

  if (entry?.playlist?.attributes) {
    return entry.playlist.attributes;
  }

  return null;
}

function resolveVariantIdentity(entry) {
  return entry?.id ?? entry?.uri ?? entry?.resolvedUri ?? entry?.playlist?.id ?? entry?.playlist?.uri ?? '';
}

function formatQualityLevelLabel(level) {
  const pixels = resolveVariantPixels(level);

  if (Number.isFinite(pixels) && pixels < Number.MAX_SAFE_INTEGER) {
    return `${pixels}p`;
  }

  const bandwidth = resolveVariantBandwidth(level);

  if (Number.isFinite(bandwidth) && bandwidth < Number.MAX_SAFE_INTEGER) {
    return `${Math.round(bandwidth / 1000)} kbps`;
  }

  return 'Auto';
}

function getSelectedQualityLevelLabel(qualityLevels) {
  const selectedIndex = Number.isFinite(qualityLevels?.selectedIndex) ? qualityLevels.selectedIndex : -1;

  if (selectedIndex < 0 || selectedIndex >= qualityLevels.length) {
    return '';
  }

  return formatQualityLevelLabel(qualityLevels[selectedIndex]);
}

function firstFinite(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return Number.NaN;
}
