import { describe, expect, it, vi } from 'vitest';
import {
  choosePreferredSubtitleLanguage,
  convertSrtToVtt,
  createImportedSubtitleTrack,
  createDefaultSubtitlePreference,
  downloadSubtitleTrack,
  fetchSubtitleCatalog,
  fetchSubtitleManifest,
  mergeSubtitleTracks,
  normalizeSubtitleManifest,
  persistSubtitlePreference,
  readStoredSubtitlePreference,
  reconcileSubtitlePreference,
  resolveDualSubtitleSwapControlState,
  resolvePlayerControlledSubtitlePreference,
  resolveToggledSubtitlePreference,
  revokeImportedSubtitleTracks,
  resolveSubtitleTracks,
  subtitleCatalogStatus,
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

class FakeBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
  }
}

function createDownloadDocument() {
  const appended = [];
  let lastCreated = null;

  const body = {
    appendChild: vi.fn((node) => {
      appended.push(node);
    }),
    removeChild: vi.fn((node) => {
      const index = appended.indexOf(node);
      if (index >= 0) {
        appended.splice(index, 1);
      }
    }),
  };

  return {
    appended,
    body,
    createElement(tag) {
      expect(tag).toBe('a');
      lastCreated = {
        click: vi.fn(),
      };

      return lastCreated;
    },
    getLastCreated() {
      return lastCreated;
    },
  };
}

describe('createDefaultSubtitlePreference', () => {
  it('defaults to auto-show without a selected language', () => {
    expect(createDefaultSubtitlePreference()).toEqual({
      mode: 'showing',
      primaryLang: '',
      secondaryLang: '',
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

describe('fetchSubtitleCatalog', () => {
  it('returns ready status with normalized tracks for a valid manifest', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: createHeaders({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        version: 1,
        tracks: [{ lang: 'en', path: 'en.vtt' }],
      }),
    });

    await expect(fetchSubtitleCatalog('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual({
      status: subtitleCatalogStatus.ready,
      tracks: [{ lang: 'en', label: 'English', path: 'en.vtt', order: 0 }],
    });
  });

  it('treats a missing manifest as ready with no tracks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: createHeaders(),
    });

    await expect(fetchSubtitleCatalog('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual({
      status: subtitleCatalogStatus.ready,
      tracks: [],
    });
  });

  it('returns error when the gateway responds with html', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: createHeaders({ 'content-type': 'text/html; charset=utf-8' }),
      json: vi.fn(),
    });

    await expect(fetchSubtitleCatalog('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual({
      status: subtitleCatalogStatus.error,
      tracks: [],
    });
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
        path: 'en.vtt',
        fileName: 'en.vtt',
        order: 1,
        source: 'remote',
      },
      {
        lang: 'zh-TW',
        label: '繁體中文',
        src: 'https://example.com/ipfs/bafy123/zh-TW.vtt',
        path: 'zh-TW.vtt',
        fileName: 'zh-TW.vtt',
        order: 2,
        source: 'remote',
      },
    ]);
  });
});

describe('convertSrtToVtt', () => {
  it('converts SRT timestamps to WebVTT', () => {
    expect(
      convertSrtToVtt('1\r\n00:00:01,000 --> 00:00:02,500\r\nHello world\r\n')
    ).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello world\n');
  });
});

describe('createImportedSubtitleTrack', () => {
  it('creates a local VTT track from an imported SRT file', async () => {
    let capturedBlob = null;
    const createObjectURL = vi.fn().mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:subtitle-local';
    });

    await expect(
      createImportedSubtitleTrack(
        {
          name: 'movie.zh-TW.srt',
          text: async () => '1\n00:00:01,000 --> 00:00:02,500\n你好\n',
        },
        { order: 4 },
        { createObjectURL, BlobImpl: FakeBlob }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        lang: 'zh-TW',
        label: '繁體中文 (Local)',
        src: 'blob:subtitle-local',
        order: 4,
        source: 'local',
        fileName: 'movie.zh-TW.vtt',
      })
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(FakeBlob);
    expect(capturedBlob.parts.join('')).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n你好\n');
  });

  it('rejects unsupported subtitle formats', async () => {
    await expect(
      createImportedSubtitleTrack(
        {
          name: 'movie.ass',
          text: async () => '[Script Info]',
        },
        {},
        { createObjectURL: vi.fn(), BlobImpl: FakeBlob }
      )
    ).rejects.toThrow('目前只支援 .vtt 與 .srt 字幕檔。');
  });
});

describe('mergeSubtitleTracks', () => {
  it('lets imported subtitles override remote tracks of the same language', () => {
    expect(
      mergeSubtitleTracks(
        [
          {
            lang: 'en',
            label: 'English',
            src: 'https://example.com/ipfs/bafy123/en.vtt',
            path: 'en.vtt',
            fileName: 'en.vtt',
            order: 0,
            source: 'remote',
          },
          {
            lang: 'zh-TW',
            label: '繁體中文',
            src: 'https://example.com/ipfs/bafy123/zh-TW.vtt',
            path: 'zh-TW.vtt',
            fileName: 'zh-TW.vtt',
            order: 1,
            source: 'remote',
          },
        ],
        [
          {
            id: 'local:en',
            lang: 'en',
            label: 'English (Local)',
            src: 'blob:en',
            order: 0,
            source: 'local',
            fileName: 'english.vtt',
          },
        ]
      )
    ).toEqual([
      {
        id: 'local:en',
        lang: 'en',
        label: 'English (Local)',
        src: 'blob:en',
        order: 0,
        source: 'local',
        fileName: 'english.vtt',
      },
      {
        lang: 'zh-TW',
        label: '繁體中文',
        src: 'https://example.com/ipfs/bafy123/zh-TW.vtt',
        path: 'zh-TW.vtt',
        fileName: 'zh-TW.vtt',
        order: 1,
        source: 'remote',
      },
    ]);
  });
});

describe('downloadSubtitleTrack', () => {
  it('downloads remote subtitles through a blob URL with a stable filename', async () => {
    vi.useFakeTimers();
    const documentLike = createDownloadDocument();
    const createObjectURL = vi.fn().mockReturnValue('blob:download');
    const revokeObjectURL = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new FakeBlob(['WEBVTT\n'], { type: 'text/vtt' })),
    });

    try {
      await downloadSubtitleTrack(
        {
          lang: 'en',
          src: 'https://example.com/ipfs/bafy123/en.vtt',
          fileName: 'en.vtt',
          source: 'remote',
        },
        {
          fetchImpl,
          createObjectURL,
          revokeObjectURL,
          documentLike,
        }
      );

      expect(fetchImpl).toHaveBeenCalledWith(
        'https://example.com/ipfs/bafy123/en.vtt',
        expect.objectContaining({
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
        })
      );
      expect(documentLike.appended).toHaveLength(0);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(documentLike.body.appendChild).toHaveBeenCalledTimes(1);
      expect(documentLike.body.removeChild).toHaveBeenCalledTimes(1);
      expect(documentLike.getLastCreated()).toEqual(
        expect.objectContaining({
          href: 'blob:download',
          download: 'en.vtt',
        })
      );
      expect(documentLike.getLastCreated().click).toHaveBeenCalledTimes(1);

      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
    } finally {
      vi.useRealTimers();
    }
  });

  it('revokes imported blob URLs when tracks are cleared', () => {
    const revokeObjectURL = vi.fn();

    revokeImportedSubtitleTracks(
      [
        { source: 'local', src: 'blob:first' },
        { source: 'remote', src: 'https://example.com/en.vtt' },
        { source: 'local', src: 'blob:second' },
      ],
      { revokeObjectURL }
    );

    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:first');
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:second');
  });
});

describe('subtitle preference storage', () => {
  it('stores and reads subtitle mode and primary/secondary language', () => {
    const storage = createStorage();

    persistSubtitlePreference({ mode: 'showing', primaryLang: 'zh-TW', secondaryLang: 'en' }, storage);

    expect(readStoredSubtitlePreference(storage)).toEqual({
      mode: 'showing',
      primaryLang: 'zh-TW',
      secondaryLang: 'en',
    });
  });

  it('keeps backward compatibility with the legacy single-language payload', () => {
    const storage = createStorage();

    storage.setItem('ipfs-hls-subtitle-preference', JSON.stringify({ mode: 'showing', lang: 'ja' }));

    expect(readStoredSubtitlePreference(storage)).toEqual({
      mode: 'showing',
      primaryLang: 'ja',
      secondaryLang: '',
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

  it('falls back to English before choosing the first available track', () => {
    expect(
      choosePreferredSubtitleLanguage(
        [{ lang: 'ja' }, { lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['fr-FR'] }
      )
    ).toBe('en');
  });
});

describe('reconcileSubtitlePreference', () => {
  it('auto-enables subtitles while choosing a preferred language for first run', () => {
    expect(
      reconcileSubtitlePreference(
        createDefaultSubtitlePreference(),
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['zh-TW', 'en-US'] }
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'zh-TW',
      secondaryLang: '',
    });
  });

  it('falls back to browser language when a stored track is missing', () => {
    expect(
      reconcileSubtitlePreference(
        { mode: 'showing', primaryLang: 'ja', secondaryLang: 'zh-TW' },
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['en-US'] }
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'en',
      secondaryLang: 'zh-TW',
    });
  });

  it('drops the secondary language when it collides with the primary one', () => {
    expect(
      reconcileSubtitlePreference(
        { mode: 'showing', primaryLang: 'en', secondaryLang: 'en-US' },
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['zh-TW'] }
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'en',
      secondaryLang: '',
    });
  });
});

describe('resolveToggledSubtitlePreference', () => {
  it('turns subtitles on with the reconciled language when nothing is currently showing', () => {
    expect(
      resolveToggledSubtitlePreference(
        createDefaultSubtitlePreference(),
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['zh-TW'] }
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'zh-TW',
      secondaryLang: '',
    });
  });

  it('turns subtitles off while preserving active primary/secondary languages', () => {
    expect(
      resolveToggledSubtitlePreference(
        { mode: 'showing', primaryLang: 'en', secondaryLang: 'zh-TW' },
        [{ lang: 'en' }, { lang: 'zh-TW' }, { lang: 'ja' }],
        { languages: ['zh-TW'] },
        ['en-US', 'zh-HK']
      )
    ).toEqual({
      mode: 'off',
      primaryLang: 'en',
      secondaryLang: 'zh-TW',
    });
  });
});

describe('resolvePlayerControlledSubtitlePreference', () => {
  it('treats a player menu selection as the next primary subtitle while preserving the configured secondary subtitle', () => {
    expect(
      resolvePlayerControlledSubtitlePreference(
        { mode: 'showing', primaryLang: 'en', secondaryLang: 'zh-TW' },
        [{ lang: 'en' }, { lang: 'zh-TW' }, { lang: 'ja' }],
        { languages: ['ja'] },
        ['ja']
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'ja',
      secondaryLang: 'zh-TW',
    });
  });

  it('clears the secondary subtitle when the player menu selects the same language as the secondary track', () => {
    expect(
      resolvePlayerControlledSubtitlePreference(
        { mode: 'showing', primaryLang: 'en', secondaryLang: 'zh-TW' },
        [{ lang: 'en' }, { lang: 'zh-TW' }, { lang: 'ja' }],
        { languages: ['ja'] },
        ['zh-HK']
      )
    ).toEqual({
      mode: 'showing',
      primaryLang: 'zh-TW',
      secondaryLang: '',
    });
  });
});

describe('resolveDualSubtitleSwapControlState', () => {
  it('keeps the swap button visible but disabled when dual subtitles are configured and subtitles are off', () => {
    expect(
      resolveDualSubtitleSwapControlState(
        { mode: 'off', primaryLang: 'en', secondaryLang: 'zh-TW' },
        [{ lang: 'en' }, { lang: 'zh-TW' }, { lang: 'ja' }],
        { languages: ['ja'] }
      )
    ).toEqual({
      visible: true,
      enabled: false,
      tooltip: '字幕目前關閉，先開啟字幕',
    });
  });

  it('hides the swap button until both primary and secondary subtitles are configured', () => {
    expect(
      resolveDualSubtitleSwapControlState(
        { mode: 'showing', primaryLang: 'en', secondaryLang: '' },
        [{ lang: 'en' }, { lang: 'zh-TW' }],
        { languages: ['zh-TW'] }
      )
    ).toEqual({
      visible: false,
      enabled: false,
      tooltip: '需要同時設定主字幕和副字幕',
    });
  });
});
