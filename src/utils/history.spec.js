import { describe, expect, it, vi } from 'vitest';
import {
  clearHistory,
  defaultHistoryLimit,
  historyStorageKey,
  readStoredHistory,
  removeHistoryEntry,
  upsertHistoryEntry,
} from './history';

function createStorage() {
  const data = new Map();

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

describe('history storage', () => {
  it('returns an empty list when storage is unavailable', () => {
    expect(readStoredHistory(null)).toEqual([]);
  });

  it('stores and sorts entries by most recent update', () => {
    const storage = createStorage();

    upsertHistoryEntry(
      {
        cid: 'bafy-old',
        title: 'Old title',
        progressSeconds: 12,
        lastWatchedAt: 100,
      },
      storage
    );
    const nextItems = upsertHistoryEntry(
      {
        cid: 'bafy-new',
        title: 'New title',
        progressSeconds: 45,
        lastWatchedAt: 200,
      },
      storage
    );

    expect(nextItems.map((item) => item.cid)).toEqual(['bafy-new', 'bafy-old']);
    expect(readStoredHistory(storage).map((item) => item.cid)).toEqual(['bafy-new', 'bafy-old']);
  });

  it('merges non-empty fields with existing entries instead of blanking them out', () => {
    const storage = createStorage();

    upsertHistoryEntry(
      {
        cid: 'bafy-history',
        title: 'Loaded title',
        uploader: 'Uploader',
        durationString: '10:16',
        progressSeconds: 25,
        lastWatchedAt: 100,
      },
      storage
    );

    const nextItems = upsertHistoryEntry(
      {
        cid: 'bafy-history',
        title: '',
        uploader: '',
        progressSeconds: 0,
        lastWatchedAt: 150,
      },
      storage
    );

    expect(nextItems).toEqual([
      {
        cid: 'bafy-history',
        title: 'Loaded title',
        uploader: 'Uploader',
        posterUrl: '',
        gateway: '',
        durationString: '10:16',
        durationSeconds: 0,
        progressSeconds: 25,
        lastWatchedAt: 150,
      },
    ]);
  });

  it('removes entries by cid and clears the whole list', () => {
    const storage = createStorage();

    upsertHistoryEntry({ cid: 'bafy-a', title: 'A', lastWatchedAt: 100 }, storage);
    upsertHistoryEntry({ cid: 'bafy-b', title: 'B', lastWatchedAt: 200 }, storage);

    expect(removeHistoryEntry('bafy-a', storage).map((item) => item.cid)).toEqual(['bafy-b']);
    expect(clearHistory(storage)).toEqual([]);
    expect(storage.getItem(historyStorageKey)).toBe(null);
  });

  it('caps stored items to the configured limit', () => {
    const storage = createStorage();

    for (let index = 0; index < defaultHistoryLimit + 5; index += 1) {
      upsertHistoryEntry(
        {
          cid: `bafy-${index}`,
          title: `Video ${index}`,
          lastWatchedAt: index + 1,
        },
        storage
      );
    }

    const items = readStoredHistory(storage);
    expect(items).toHaveLength(defaultHistoryLimit);
    expect(items[0].cid).toBe(`bafy-${defaultHistoryLimit + 4}`);
  });

  it('returns an empty list when stored JSON is invalid', () => {
    const storage = createStorage();
    storage.setItem(historyStorageKey, '{broken');

    expect(readStoredHistory(storage)).toEqual([]);
  });

  it('normalizes missing timestamps using the current time', () => {
    const storage = createStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const items = upsertHistoryEntry(
      {
        cid: 'bafy-now',
        title: 'Uses now',
      },
      storage
    );

    expect(items[0].lastWatchedAt).toBe(Date.parse('2026-03-21T10:00:00Z'));
    vi.useRealTimers();
  });
});
