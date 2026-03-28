export const savedVideosStorageKey = 'ipfs-hls-saved-videos';
export const defaultSavedVideosLimit = 100;

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

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number.parseInt(value ?? '', 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function normalizeTimestamp(value) {
  const numeric = Number.parseInt(value ?? '', 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : Date.now();
}

function sortSavedVideoItems(items) {
  return [...items].sort((left, right) => (right.savedAt ?? 0) - (left.savedAt ?? 0));
}

function writeStoredSavedVideos(items, target) {
  const storage = resolveStorage(target);
  if (!storage) return;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      if (typeof storage.removeItem === 'function') {
        storage.removeItem(savedVideosStorageKey);
      }
      return;
    }

    storage.setItem(savedVideosStorageKey, JSON.stringify(items));
  } catch (_) {
    // ignore storage errors
  }
}

export function normalizeSavedVideoItem(payload = {}) {
  return {
    cid: normalizeString(payload.cid),
    seriesCid: normalizeString(payload.seriesCid),
    episodeId: normalizeString(payload.episodeId),
    episodePath: normalizeString(payload.episodePath),
    title: normalizeString(payload.title),
    uploader: normalizeString(payload.uploader),
    posterUrl: normalizeString(payload.posterUrl),
    gateway: normalizeString(payload.gateway),
    durationString: normalizeString(payload.durationString),
    durationSeconds: normalizeNonNegativeInteger(payload.durationSeconds),
    savedAt: normalizeTimestamp(payload.savedAt),
  };
}

export function readStoredSavedVideos(target) {
  const storage = resolveStorage(target);
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(savedVideosStorageKey);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return sortSavedVideoItems(
      parsed
        .map((item) => normalizeSavedVideoItem(item))
        .filter((item) => item.cid)
    );
  } catch (_) {
    return [];
  }
}

function mergeSavedVideoItem(existing, next) {
  return {
    cid: next.cid || existing.cid,
    seriesCid: next.seriesCid || existing.seriesCid,
    episodeId: next.episodeId || existing.episodeId,
    episodePath: next.episodePath || existing.episodePath,
    title: next.title || existing.title,
    uploader: next.uploader || existing.uploader,
    posterUrl: next.posterUrl || existing.posterUrl,
    gateway: next.gateway || existing.gateway,
    durationString: next.durationString || existing.durationString,
    durationSeconds: next.durationSeconds > 0 ? next.durationSeconds : existing.durationSeconds,
    savedAt: next.savedAt || existing.savedAt || Date.now(),
  };
}

export function upsertSavedVideoEntry(entry, target, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : defaultSavedVideosLimit;
  const normalizedEntry = normalizeSavedVideoItem(entry);

  if (!normalizedEntry.cid) {
    return readStoredSavedVideos(target);
  }

  const currentItems = readStoredSavedVideos(target);
  const existingIndex = currentItems.findIndex((item) => item.cid === normalizedEntry.cid);
  const mergedEntry =
    existingIndex >= 0 ? mergeSavedVideoItem(currentItems[existingIndex], normalizedEntry) : normalizedEntry;

  const nextItems = sortSavedVideoItems([
    mergedEntry,
    ...currentItems.filter((item) => item.cid !== normalizedEntry.cid),
  ]).slice(0, limit);

  writeStoredSavedVideos(nextItems, target);
  return nextItems;
}

export function removeSavedVideoEntry(cid, target) {
  const normalizedCid = normalizeString(cid);
  if (!normalizedCid) {
    return readStoredSavedVideos(target);
  }

  const nextItems = readStoredSavedVideos(target).filter((item) => item.cid !== normalizedCid);
  writeStoredSavedVideos(nextItems, target);
  return nextItems;
}
