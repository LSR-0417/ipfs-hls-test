import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  avatarAssetFileName,
  buildSidecarGatewayCandidates,
  loadAvatarUrlWithFallback,
  loadPosterUrlWithFallback,
  loadSubtitleCatalogWithFallback,
  loadVideoInfoWithFallback,
  posterAssetFileName,
  readCachedSidecarObjectUrl,
  readCachedSubtitleCatalog,
  readCachedVideoInfo,
  resetSidecarSessionCache,
} from './sidecarAssets';

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

function createJsonResponse(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: createHeaders({ 'content-type': options.contentType ?? 'application/json' }),
    json: vi.fn().mockResolvedValue(payload),
  };
}

function createBlobResponse(marker, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: createHeaders({ 'content-type': options.contentType ?? 'image/webp' }),
    blob: vi.fn().mockResolvedValue(new FakeBlob([marker], { type: options.contentType ?? 'image/webp' })),
    text: vi.fn().mockResolvedValue(marker),
  };
}

beforeEach(() => {
  resetSidecarSessionCache({ revokeObjectURL: vi.fn() });
});

describe('buildSidecarGatewayCandidates', () => {
  it('keeps the primary gateway first, dedupes candidates, and appends built-in fallbacks', () => {
    expect(
      buildSidecarGatewayCandidates('https://custom.example/ipfs/', [
        'https://ipfs.io/ipfs/',
        'https://custom.example/ipfs/',
      ])
    ).toEqual([
      'https://custom.example/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://dweb.link/ipfs/',
    ]);
  });
});

describe('loadVideoInfoWithFallback', () => {
  it('falls back to another gateway and reuses the cached metadata across gateway switches', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://broken.example/ipfs/bafy123/info.json') {
        return createJsonResponse({}, { ok: false, status: 504 });
      }

      if (url === 'https://dweb.link/ipfs/bafy123/info.json') {
        return createJsonResponse({
          title: 'Loaded from fallback',
          uploader: 'Uploader',
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(
      loadVideoInfoWithFallback('bafy123', 'https://broken.example/ipfs/', ['https://dweb.link/ipfs/'], { fetchImpl })
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'Loaded from fallback',
        uploader: 'Uploader',
      })
    );

    expect(readCachedVideoInfo('bafy123')).toEqual(
      expect.objectContaining({
        title: 'Loaded from fallback',
        uploader: 'Uploader',
      })
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await expect(
      loadVideoInfoWithFallback('bafy123', 'https://ipfs.io/ipfs/', ['https://dweb.link/ipfs/'], { fetchImpl })
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'Loaded from fallback',
        uploader: 'Uploader',
      })
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('loadPosterUrlWithFallback', () => {
  it('creates and reuses a CID-scoped object URL for poster sidecars', async () => {
    const createObjectURL = vi.fn().mockImplementation((blob) => `blob:${blob.parts.join('')}`);
    const fetchImpl = vi.fn(async (url) => {
      if (url === `https://broken.example/ipfs/bafy123/${posterAssetFileName}`) {
        return createBlobResponse('broken', { ok: false, status: 404 });
      }

      if (url === `https://dweb.link/ipfs/bafy123/${posterAssetFileName}`) {
        return createBlobResponse('poster');
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(
      loadPosterUrlWithFallback('bafy123', 'https://broken.example/ipfs/', ['https://dweb.link/ipfs/'], {
        fetchImpl,
        createObjectURL,
        BlobImpl: FakeBlob,
      })
    ).resolves.toBe('blob:poster');

    expect(readCachedSidecarObjectUrl('bafy123', posterAssetFileName)).toBe('blob:poster');
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await expect(
      loadPosterUrlWithFallback('bafy123', 'https://ipfs.io/ipfs/', ['https://dweb.link/ipfs/'], {
        fetchImpl,
        createObjectURL,
        BlobImpl: FakeBlob,
      })
    ).resolves.toBe('blob:poster');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('caches avatar sidecars independently from posters', async () => {
    const createObjectURL = vi.fn().mockImplementation((blob) => `blob:${blob.parts.join('')}`);
    const fetchImpl = vi.fn(async (url) => {
      if (url === `https://dweb.link/ipfs/bafy123/${avatarAssetFileName}`) {
        return createBlobResponse('avatar', { contentType: 'image/jpeg' });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(
      loadAvatarUrlWithFallback('bafy123', 'https://dweb.link/ipfs/', [], {
        fetchImpl,
        createObjectURL,
        BlobImpl: FakeBlob,
      })
    ).resolves.toBe('blob:avatar');

    expect(readCachedSidecarObjectUrl('bafy123', avatarAssetFileName)).toBe('blob:avatar');
  });
});

describe('loadSubtitleCatalogWithFallback', () => {
  it('loads the manifest from a fallback gateway, materializes subtitle files, and reuses them across gateway switches', async () => {
    const createObjectURL = vi.fn().mockImplementation((blob) => `blob:${blob.parts.join('')}`);
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://broken.example/ipfs/bafy123/subtitles.json') {
        return createJsonResponse({}, { ok: false, status: 504 });
      }

      if (url === 'https://dweb.link/ipfs/bafy123/subtitles.json') {
        return createJsonResponse({
          tracks: [{ lang: 'en', path: 'en.vtt' }],
        });
      }

      if (url === 'https://broken.example/ipfs/bafy123/en.vtt') {
        return createBlobResponse('subtitle-broken', { ok: false, status: 404, contentType: 'text/vtt' });
      }

      if (url === 'https://dweb.link/ipfs/bafy123/en.vtt') {
        return createBlobResponse('subtitle-en', { contentType: 'text/vtt' });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(
      loadSubtitleCatalogWithFallback('bafy123', 'https://broken.example/ipfs/', ['https://dweb.link/ipfs/'], {
        fetchImpl,
        createObjectURL,
        BlobImpl: FakeBlob,
      })
    ).resolves.toEqual({
      status: 'ready',
      tracks: [
        {
          lang: 'en',
          label: 'English',
          src: 'blob:subtitle-en',
          path: 'en.vtt',
          fileName: 'en.vtt',
          order: 0,
          source: 'remote',
        },
      ],
    });

    const cachedCatalog = readCachedSubtitleCatalog('bafy123', 'https://ipfs.io/ipfs/', ['https://dweb.link/ipfs/']);
    expect(cachedCatalog).toEqual({
      status: 'ready',
      tracks: [
        {
          lang: 'en',
          label: 'English',
          src: 'blob:subtitle-en',
          path: 'en.vtt',
          fileName: 'en.vtt',
          order: 0,
          source: 'remote',
        },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    await expect(
      loadSubtitleCatalogWithFallback('bafy123', 'https://ipfs.io/ipfs/', ['https://dweb.link/ipfs/'], {
        fetchImpl,
        createObjectURL,
        BlobImpl: FakeBlob,
      })
    ).resolves.toEqual(cachedCatalog);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('returns ready with no tracks when every gateway reports the manifest as missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createJsonResponse({}, { ok: false, status: 404 }));

    await expect(
      loadSubtitleCatalogWithFallback('bafy123', 'https://ipfs.io/ipfs/', ['https://dweb.link/ipfs/'], { fetchImpl })
    ).resolves.toEqual({
      status: 'ready',
      tracks: [],
    });
  });
});
