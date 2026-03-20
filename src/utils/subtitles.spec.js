import { describe, expect, it, vi } from 'vitest';
import {
  choosePreferredSubtitleLanguage,
  createDefaultSubtitlePreference,
  fetchSubtitleManifest,
  normalizeSubtitleManifest,
  persistSubtitlePreference,
  readStoredSubtitlePreference,
  reconcileSubtitlePreference,
  resolveSubtitleTracks,
  subtitleManifestFileName,
} from './subtitles';

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

function createHeaders(values = {}) {
  const entries = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));

  return {
    get(name) {
      return entries.get(String(name).toLowerCase()) ?? null;
    },
  };
}

describe('createDefaultSubtitlePreference', () => {
  it('defaults to off without a selected language', () => {
    expect(createDefaultSubtitlePreference()).toEqual({
      mode: 'off',
      lang: '',
    });
  });
});

describe('normalizeSubtitleManifest', () => {
  it('normalizes manifest tracks and fills labels', () => {
    expect(
      normalizeSubtitleManifest({
        version: 1,
        tracks: [
          { lang: 'en', path: 'en.vtt' },
          { lang: 'zh-TW', path: 'zh-TW.vtt', label: '中文字幕', order: 5 },
          { lang: '', path: 'broken.vtt' },
        ],
      })
    ).toEqual([
      { lang: 'en', label: 'English', path: 'en.vtt', order: 0 },
      { lang: 'zh-TW', label: '中文字幕', path: 'zh-TW.vtt', order: 5 },
    ]);
  });
});

describe('fetchSubtitleManifest', () => {
  it('returns normalized tracks from subtitles.json', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: createHeaders({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        version: 1,
        tracks: [{ lang: 'en', path: 'en.vtt' }],
      }),
    });

    await expect(fetchSubtitleManifest('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual([
      { lang: 'en', label: 'English', path: 'en.vtt', order: 0 },
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      `https://example.com/ipfs/bafy123/${subtitleManifestFileName}`,
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
      })
    );
  });

  it('returns an empty list for missing manifests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: createHeaders() });

    await expect(fetchSubtitleManifest('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual([]);
  });
});

describe('resolveSubtitleTracks', () => {
  it('converts manifest tracks into player tracks', () => {
    expect(
      resolveSubtitleTracks('https://example.com/ipfs/bafy123/', [
        { lang: 'zh-TW', path: 'zh-TW.vtt', order: 2 },
        { lang: 'en', path: 'en.vtt', order: 1 },
      ])
    ).toEqual([
      {
        lang: 'en',
        label: 'English',
        src: 'https://example.com/ipfs/bafy123/en.vtt',
        order: 1,
      },
      {
        lang: 'zh-TW',
        label: '繁體中文',
        src: 'https://example.com/ipfs/bafy123/zh-TW.vtt',
        order: 2,
      },
    ]);
  });
});

describe('subtitle preference storage', () => {
  it('stores and reads subtitle mode and language', () => {
    const storage = createStorage();

    persistSubtitlePreference({ mode: 'showing', lang: 'zh-TW' }, storage);

    expect(readStoredSubtitlePreference(storage)).toEqual({
      mode: 'showing',
      lang: 'zh-TW',
    });
  });
});

describe('choosePreferredSubtitleLanguage', () => {
  it('prefers exact browser language matches and falls back to base language', () => {
    const subtitles = [
      { lang: 'zh-TW' },
      { lang: 'en' },
    ];

    expect(choosePreferredSubtitleLanguage(subtitles, { languages: ['en-US', 'zh-TW'] })).toBe('en');
    expect(choosePreferredSubtitleLanguage(subtitles, { languages: ['zh-HK'] })).toBe('zh-TW');
  });
});

describe('reconcileSubtitlePreference', () => {
  it('keeps the default mode off while choosing a preferred language for first run', () => {
    expect(
      reconcileSubtitlePreference(
        createDefaultSubtitlePreference(),
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['zh-TW', 'en-US'] }
      )
    ).toEqual({
      mode: 'off',
      lang: 'zh-TW',
    });
  });

  it('falls back to browser language when a stored track is missing', () => {
    expect(
      reconcileSubtitlePreference(
        { mode: 'showing', lang: 'ja' },
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['en-US'] }
      )
    ).toEqual({
      mode: 'showing',
      lang: 'en',
    });
  });
});
