export const historyStorageKey = 'ipfs-hls-watch-history';
export const defaultHistoryLimit = 100;

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

function sortHistoryItems(items) {
  return [...items].sort((left, right) => (right.lastWatchedAt ?? 0) - (left.lastWatchedAt ?? 0));
}

function writeStoredHistory(items, target) {
  const storage = resolveStorage(target);
  if (!storage) return;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      if (typeof storage.removeItem === 'function') {
        storage.removeItem(historyStorageKey);
      }
      return;
    }

    storage.setItem(historyStorageKey, JSON.stringify(items));
  } catch (_) {
    // ignore storage errors
  }
}

export function normalizeHistoryItem(payload = {}) {
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
    progressSeconds: normalizeNonNegativeInteger(payload.progressSeconds),
    lastWatchedAt: normalizeTimestamp(payload.lastWatchedAt),
  };
}

export function readStoredHistory(target) {
  const storage = resolveStorage(target);
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(historyStorageKey);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return sortHistoryItems(
      parsed
        .map((item) => normalizeHistoryItem(item))
        .filter((item) => item.cid)
    );
  } catch (_) {
    return [];
  }
}

function mergeHistoryItem(existing, next) {
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
    progressSeconds: next.progressSeconds > 0 ? next.progressSeconds : existing.progressSeconds,
    lastWatchedAt: next.lastWatchedAt || existing.lastWatchedAt || Date.now(),
  };
}

export function upsertHistoryEntry(entry, target, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : defaultHistoryLimit;
  const normalizedEntry = normalizeHistoryItem(entry);

  if (!normalizedEntry.cid) {
    return readStoredHistory(target);
  }

  const currentItems = readStoredHistory(target);
  const existingIndex = currentItems.findIndex((item) => item.cid === normalizedEntry.cid);
  const mergedEntry =
    existingIndex >= 0 ? mergeHistoryItem(currentItems[existingIndex], normalizedEntry) : normalizedEntry;

  const nextItems = sortHistoryItems([
    mergedEntry,
    ...currentItems.filter((item) => item.cid !== normalizedEntry.cid),
  ]).slice(0, limit);

  writeStoredHistory(nextItems, target);
  return nextItems;
}

export function removeHistoryEntry(cid, target) {
  const normalizedCid = normalizeString(cid);
  if (!normalizedCid) {
    return readStoredHistory(target);
  }

  const nextItems = readStoredHistory(target).filter((item) => item.cid !== normalizedCid);
  writeStoredHistory(nextItems, target);
  return nextItems;
}

export function clearHistory(target) {
  writeStoredHistory([], target);
  return [];
}
