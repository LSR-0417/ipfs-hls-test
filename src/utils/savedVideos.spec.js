import { describe, expect, it, vi } from 'vitest';
import {
  defaultSavedVideosLimit,
  readStoredSavedVideos,
  removeSavedVideoEntry,
  savedVideosStorageKey,
  upsertSavedVideoEntry,
} from './savedVideos';

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

describe('saved videos storage', () => {
  it('returns an empty list when storage is unavailable', () => {
    expect(readStoredSavedVideos(null)).toEqual([]);
  });

  it('stores and sorts saved entries by most recent save time', () => {
    const storage = createStorage();

    upsertSavedVideoEntry(
      {
        cid: 'bafy-old',
        title: 'Old title',
        savedAt: 100,
      },
      storage
    );
    const nextItems = upsertSavedVideoEntry(
      {
        cid: 'bafy-new',
        title: 'New title',
        savedAt: 200,
      },
      storage
    );

    expect(nextItems.map((item) => item.cid)).toEqual(['bafy-new', 'bafy-old']);
    expect(readStoredSavedVideos(storage).map((item) => item.cid)).toEqual(['bafy-new', 'bafy-old']);
  });

  it('merges non-empty fields with existing entries instead of blanking them out', () => {
    const storage = createStorage();

    upsertSavedVideoEntry(
      {
        cid: 'bafy-saved',
        title: 'Saved title',
        uploader: 'Uploader',
        durationString: '10:16',
        savedAt: 100,
      },
      storage
    );

    const nextItems = upsertSavedVideoEntry(
      {
        cid: 'bafy-saved',
        title: '',
        uploader: '',
        savedAt: 150,
      },
      storage
    );

    expect(nextItems).toEqual([
      {
        cid: 'bafy-saved',
        seriesCid: '',
        episodeId: '',
        episodePath: '',
        title: 'Saved title',
        uploader: 'Uploader',
        posterUrl: '',
        gateway: '',
        durationString: '10:16',
        durationSeconds: 0,
        savedAt: 150,
      },
    ]);
  });

  it('deduplicates by cid and moves a re-saved item to the top', () => {
    const storage = createStorage();

    upsertSavedVideoEntry({ cid: 'bafy-a', title: 'A', savedAt: 100 }, storage);
    upsertSavedVideoEntry({ cid: 'bafy-b', title: 'B', savedAt: 200 }, storage);

    const nextItems = upsertSavedVideoEntry({ cid: 'bafy-a', title: 'A', savedAt: 300 }, storage);

    expect(nextItems.map((item) => item.cid)).toEqual(['bafy-a', 'bafy-b']);
    expect(nextItems).toHaveLength(2);
  });

  it('removes entries by cid', () => {
    const storage = createStorage();

    upsertSavedVideoEntry({ cid: 'bafy-a', title: 'A', savedAt: 100 }, storage);
    upsertSavedVideoEntry({ cid: 'bafy-b', title: 'B', savedAt: 200 }, storage);

    expect(removeSavedVideoEntry('bafy-a', storage).map((item) => item.cid)).toEqual(['bafy-b']);
    expect(readStoredSavedVideos(storage).map((item) => item.cid)).toEqual(['bafy-b']);
  });

  it('caps stored items to the configured limit', () => {
    const storage = createStorage();

    for (let index = 0; index < defaultSavedVideosLimit + 5; index += 1) {
      upsertSavedVideoEntry(
        {
          cid: `bafy-${index}`,
          title: `Video ${index}`,
          savedAt: index + 1,
        },
        storage
      );
    }

    const items = readStoredSavedVideos(storage);
    expect(items).toHaveLength(defaultSavedVideosLimit);
    expect(items[0].cid).toBe(`bafy-${defaultSavedVideosLimit + 4}`);
  });

  it('returns an empty list when stored JSON is invalid', () => {
    const storage = createStorage();
    storage.setItem(savedVideosStorageKey, '{broken');

    expect(readStoredSavedVideos(storage)).toEqual([]);
  });

  it('normalizes missing timestamps using the current time', () => {
    const storage = createStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const items = upsertSavedVideoEntry(
      {
        cid: 'bafy-now',
        title: 'Uses now',
      },
      storage
    );

    expect(items[0].savedAt).toBe(Date.parse('2026-03-21T10:00:00Z'));
    vi.useRealTimers();
  });

  it('retains series episode context when present', () => {
    const storage = createStorage();

    const items = upsertSavedVideoEntry(
      {
        cid: 'bafy-series/ep02',
        seriesCid: 'bafy-series',
        episodeId: 'ep02',
        episodePath: 'ep02',
        title: 'Episode 2',
        savedAt: 100,
      },
      storage
    );

    expect(items[0]).toEqual({
      cid: 'bafy-series/ep02',
      seriesCid: 'bafy-series',
      episodeId: 'ep02',
      episodePath: 'ep02',
      title: 'Episode 2',
      uploader: '',
      posterUrl: '',
      gateway: '',
      durationString: '',
      durationSeconds: 0,
      savedAt: 100,
    });
  });
});
