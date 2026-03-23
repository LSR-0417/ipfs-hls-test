import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGatewayAssetUrl,
  buildGatewayIndexUrl,
  customGatewayStorageKey,
  fetchGatewayVariantPlaylists,
  gatewayRateLimitBackoffMs,
  gatewayProbeSegmentSampleCount,
  gatewayStorageKey,
  isDisabledGatewayInput,
  isLoopbackGatewayUrl,
  isLoopbackHostname,
  isPrivateHostname,
  normalizeGatewayUrl,
  persistCustomGateway,
  persistGateway,
  probeGatewayAvailability,
  readStoredCustomGateway,
  readStoredGateway,
  shouldAutoFallbackGateway,
} from './gateway';

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

function createResponse({ ok = true, status = 200, headers = {}, text = '', bodyChunks = [new Uint8Array(262144)] } = {}) {
  let chunkIndex = 0;

  return {
    ok,
    status,
    headers: createHeaders(headers),
    text: vi.fn().mockResolvedValue(text),
    body: {
      getReader() {
        return {
          read: vi.fn().mockImplementation(async () => {
            if (chunkIndex >= bodyChunks.length) {
              return { done: true, value: undefined };
            }

            const value = bodyChunks[chunkIndex];
            chunkIndex += 1;
            return { done: false, value };
          }),
          cancel: vi.fn().mockResolvedValue(undefined),
        };
      },
    },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('readStoredGateway', () => {
  it('returns a trimmed gateway from storage', () => {
    const storage = createStorage();
    storage.setItem(gatewayStorageKey, ' https://example.com/ipfs/ ');

    expect(readStoredGateway(storage)).toBe('https://example.com/ipfs/');
  });

  it('returns empty string when storage is missing', () => {
    expect(readStoredGateway(null)).toBe('');
  });
});

describe('persistGateway', () => {
  it('stores the trimmed gateway', () => {
    const storage = createStorage();

    persistGateway(' https://dweb.link/ipfs/ ', storage);

    expect(storage.getItem(gatewayStorageKey)).toBe('https://dweb.link/ipfs/');
  });

  it('removes the value when gateway is blank', () => {
    const storage = createStorage();
    storage.setItem(gatewayStorageKey, 'https://gateway.pinata.cloud/ipfs/');

    persistGateway('   ', storage);

    expect(storage.getItem(gatewayStorageKey)).toBe(null);
  });
});

describe('custom gateway storage', () => {
  it('stores and reads the trimmed custom gateway', () => {
    const storage = createStorage();

    persistCustomGateway(' https://friend.example/ipfs/ ', storage);

    expect(storage.getItem(customGatewayStorageKey)).toBe('https://friend.example/ipfs/');
    expect(readStoredCustomGateway(storage)).toBe('https://friend.example/ipfs/');
  });
});

describe('isPrivateHostname', () => {
  it('detects localhost and RFC1918 ranges', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
    expect(isPrivateHostname('10.0.0.8')).toBe(true);
    expect(isPrivateHostname('172.16.0.1')).toBe(true);
    expect(isPrivateHostname('192.168.1.7')).toBe(true);
  });

  it('does not treat public hosts as private', () => {
    expect(isPrivateHostname('gateway.pinata.cloud')).toBe(false);
    expect(isPrivateHostname('8.8.8.8')).toBe(false);
  });
});

describe('isLoopbackHostname', () => {
  it('detects localhost and 127.x loopback hosts only', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('192.168.1.7')).toBe(false);
    expect(isLoopbackHostname('10.0.0.8')).toBe(false);
  });
});

describe('isLoopbackGatewayUrl', () => {
  it('matches loopback gateways but not LAN or public gateways', () => {
    expect(isLoopbackGatewayUrl('http://127.0.0.1:8080/ipfs/')).toBe(true);
    expect(isLoopbackGatewayUrl('http://localhost:8080/ipfs/')).toBe(true);
    expect(isLoopbackGatewayUrl('http://192.168.1.5:8080/ipfs/')).toBe(false);
    expect(isLoopbackGatewayUrl('https://dweb.link/ipfs/')).toBe(false);
  });
});

describe('shouldAutoFallbackGateway', () => {
  it('only auto-falls back for loopback gateways in terminal probe states', () => {
    expect(shouldAutoFallbackGateway('http://127.0.0.1:8080/ipfs/', { state: 'failed' })).toBe(true);
    expect(shouldAutoFallbackGateway('http://127.0.0.1:8080/ipfs/', { state: 'degraded' })).toBe(true);
    expect(shouldAutoFallbackGateway('http://127.0.0.1:8080/ipfs/', { state: 'playlist_ready' })).toBe(false);
    expect(shouldAutoFallbackGateway('https://dweb.link/ipfs/', { state: 'failed' })).toBe(false);
  });
});

describe('normalizeGatewayUrl', () => {
  it('normalizes public hosts to an https /ipfs/ base URL', () => {
    expect(normalizeGatewayUrl('https://example.com')).toBe('https://example.com/ipfs/');
    expect(normalizeGatewayUrl('example.com/ipfs')).toBe('https://example.com/ipfs/');
    expect(normalizeGatewayUrl('https://example.com/proxy/ipfs')).toBe('https://example.com/proxy/ipfs/');
  });

  it('rejects non-https public gateways', () => {
    expect(normalizeGatewayUrl('http://example.com/ipfs/')).toBe('');
  });

  it('rejects private hosts unless explicitly allowed', () => {
    expect(normalizeGatewayUrl('http://127.0.0.1:8080/ipfs/')).toBe('');
    expect(normalizeGatewayUrl('http://127.0.0.1:8080/ipfs/', { allowPrivateHosts: true })).toBe(
      'http://127.0.0.1:8080/ipfs/'
    );
  });

  it('rejects URLs that are not gateway base paths', () => {
    expect(normalizeGatewayUrl('https://example.com/')).toBe('https://example.com/ipfs/');
    expect(normalizeGatewayUrl('https://example.com/ipns/')).toBe('');
    expect(normalizeGatewayUrl('https://example.com/ipfs/some-cid')).toBe('');
  });

  it('rejects disabled gateways such as Pinata', () => {
    expect(isDisabledGatewayInput('https://gateway.pinata.cloud/ipfs/')).toBe(true);
    expect(normalizeGatewayUrl('https://gateway.pinata.cloud/ipfs/')).toBe('');
  });
});

describe('buildGatewayIndexUrl', () => {
  it('builds sidecar asset URLs from a gateway base and CID', () => {
    expect(buildGatewayAssetUrl('https://example.com/ipfs/', 'bafy123', 'cover.webp')).toBe(
      'https://example.com/ipfs/bafy123/cover.webp'
    );
    expect(buildGatewayAssetUrl('https://example.com/ipfs/', 'bafy123')).toBe('https://example.com/ipfs/bafy123/');
  });

  it('builds the index.m3u8 URL from a gateway base and CID', () => {
    expect(buildGatewayIndexUrl('https://example.com/ipfs/', 'bafy123')).toBe(
      'https://example.com/ipfs/bafy123/index.m3u8'
    );
  });
});

describe('probeGatewayAvailability', () => {
  it('returns ready when the playlist and sample segments are reachable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\n720p/streaminglist-720p.m3u8\n',
        });
      }

      if (url === 'https://example.com/ipfs/bafy123/720p/streaminglist-720p.m3u8') {
        return createResponse({
          text: [
            '#EXTM3U',
            '#EXTINF:5.0,',
            'segment_000.ts',
            '#EXTINF:5.0,',
            'segment_001.ts',
            '#EXTINF:5.0,',
            'segment_002.ts',
          ].join('\n'),
        });
      }

      if (/segment_00[0-2]\.ts$/.test(url)) {
        return createResponse();
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(132);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'ready',
        detail: `已預載前 ${gatewayProbeSegmentSampleCount} 個片段，可開始播放`,
        durationMs: 32,
        httpStatus: 200,
        retryAfterMs: null,
        throughputMbps: 196.61,
        playbackRate: 468.75,
        sampleSegmentCount: gatewayProbeSegmentSampleCount,
        completedSampleCount: gatewayProbeSegmentSampleCount,
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/index.m3u8',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      })
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/720p/segment_000.ts',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      })
    );
  });

  it('emits playlist-ready progress once index.m3u8 is reachable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXTINF:5.0,\nsegment_000.ts\n#EXTINF:5.0,\nsegment_001.ts\n',
        });
      }

      if (/segment_00[0-1]\.ts$/.test(url)) {
        return createResponse();
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(112)
      .mockReturnValueOnce(118)
      .mockReturnValueOnce(124)
      .mockReturnValueOnce(128);
    const onProgress = vi.fn();

    await expect(
      probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', {
        fetchImpl,
        nowFn,
        onProgress,
      })
    ).resolves.toEqual({
      state: 'ready',
      detail: '已預載前 2 個片段，可開始播放',
      durationMs: 28,
      httpStatus: 200,
      retryAfterMs: null,
      throughputMbps: 149.8,
      playbackRate: 357.14,
      sampleSegmentCount: 2,
      completedSampleCount: 2,
    });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      state: 'playlist_ready',
      detail: '已找到 index.m3u8，正在驗證片段',
      durationMs: 12,
      httpStatus: 200,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    });
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'probing',
        detail: '已預載 2/2 個片段',
        sampleSegmentCount: 2,
        completedSampleCount: 2,
      })
    );
  });

  it('returns failed when the gateway responds with an error status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const nowFn = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(55);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'failed',
        detail: '找不到 index.m3u8 (HTTP 404)',
        durationMs: 35,
        httpStatus: 404,
        retryAfterMs: null,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('returns degraded when a sampled segment is not reachable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\n720p/streaminglist-720p.m3u8\n',
        });
      }

      if (url === 'https://example.com/ipfs/bafy123/720p/streaminglist-720p.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXTINF:5.0,\nsegment_000.ts\n#EXTINF:5.0,\nsegment_001.ts\n',
        });
      }

      if (url === 'https://example.com/ipfs/bafy123/720p/segment_000.ts') {
        return createResponse({ ok: false, status: 404 });
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi.fn().mockReturnValueOnce(50).mockReturnValueOnce(88);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'degraded',
        detail: '已找到 index.m3u8，但前幾個片段不可用 (HTTP 404)',
        durationMs: 38,
        httpStatus: 404,
        retryAfterMs: null,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('keeps the gateway yellow when segments are reachable but too slow for green', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXTINF:5.0,\nsegment_000.ts\n#EXTINF:5.0,\nsegment_001.ts\n#EXTINF:5.0,\nsegment_002.ts\n',
        });
      }

      if (/segment_00[0-2]\.ts$/.test(url)) {
        return createResponse();
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(15010);

    await expect(
      probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', {
        fetchImpl,
        nowFn,
        playbackRateThreshold: 1.2,
      })
    ).resolves.toEqual({
      state: 'playlist_ready',
      detail: '已預載前 3 個片段，但下載速度偏慢',
      durationMs: 15000,
      httpStatus: 200,
      retryAfterMs: null,
      throughputMbps: 0.42,
      playbackRate: 1,
      sampleSegmentCount: 3,
      completedSampleCount: 3,
    });
  });

  it('supports index.m3u8 files that are already media playlists', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXTINF:5.0,\nsegment_000.ts\n#EXTINF:5.0,\nsegment_001.ts\n',
        });
      }

      if (/segment_00[0-1]\.ts$/.test(url)) {
        return createResponse();
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(24);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'ready',
        detail: '已預載前 2 個片段，可開始播放',
        durationMs: 14,
        httpStatus: 200,
        retryAfterMs: null,
        throughputMbps: 299.59,
        playbackRate: 714.29,
        sampleSegmentCount: 2,
        completedSampleCount: 2,
      }
    );
  });

  it('samples segments near the requested playback time when probing a handoff', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: [
            '#EXTM3U',
            '#EXTINF:5.0,',
            'segment_000.ts',
            '#EXTINF:5.0,',
            'segment_001.ts',
            '#EXTINF:5.0,',
            'segment_002.ts',
            '#EXTINF:5.0,',
            'segment_003.ts',
            '#EXTINF:5.0,',
            'segment_004.ts',
          ].join('\n'),
        });
      }

      if (/segment_00[2-4]\.ts$/.test(url)) {
        return createResponse();
      }

      throw new Error(`unexpected url: ${url}`);
    });
    const nowFn = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(124);

    await expect(
      probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', {
        fetchImpl,
        nowFn,
        startTimeSeconds: 12,
      })
    ).resolves.toEqual({
      state: 'ready',
      detail: '已預載目前播放位置附近 3 個片段，可開始播放',
      durationMs: 24,
      httpStatus: 200,
      retryAfterMs: null,
      throughputMbps: 262.14,
      playbackRate: 625,
      sampleSegmentCount: 3,
      completedSampleCount: 3,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/segment_002.ts',
      expect.any(Object)
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/segment_004.ts',
      expect.any(Object)
    );
    expect(fetchImpl).not.toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/segment_000.ts',
      expect.any(Object)
    );
  });

  it('returns a rate-limited result for 429 responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: createHeaders({ 'retry-after': '120' }),
    });
    const nowFn = vi.fn().mockReturnValueOnce(200).mockReturnValueOnce(245);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'rate_limited',
        detail: '暫時限流 (HTTP 429)',
        durationMs: 45,
        httpStatus: 429,
        retryAfterMs: 120000,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('falls back to the default backoff when retry-after is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: createHeaders(),
    });
    const nowFn = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(20);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'rate_limited',
        detail: '暫時限流 (HTTP 429)',
        durationMs: 10,
        httpStatus: 429,
        retryAfterMs: gatewayRateLimitBackoffMs,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('classifies redirects separately from bans', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      headers: createHeaders(),
    });
    const nowFn = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(8);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'redirected',
        detail: '重新導向 (HTTP 301)',
        durationMs: 8,
        httpStatus: 301,
        retryAfterMs: null,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('classifies 504 as an upstream timeout', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      headers: createHeaders(),
    });
    const nowFn = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(16);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'failed',
        detail: '來源逾時 (HTTP 504)',
        durationMs: 16,
        httpStatus: 504,
        retryAfterMs: null,
        throughputMbps: null,
        playbackRate: null,
        sampleSegmentCount: 0,
        completedSampleCount: 0,
      }
    );
  });

  it('returns failed on timeout', async () => {
    vi.useFakeTimers();
    const nowFn = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(50);

    const fetchImpl = vi.fn((_, init) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    });

    const probePromise = probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', {
      fetchImpl,
      timeoutMs: 50,
      nowFn,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(probePromise).resolves.toEqual({
      state: 'failed',
      detail: '逾時，找不到 index.m3u8',
      durationMs: 50,
      httpStatus: null,
      retryAfterMs: null,
      throughputMbps: null,
      playbackRate: null,
      sampleSegmentCount: 0,
      completedSampleCount: 0,
    });
  });
});

describe('fetchGatewayVariantPlaylists', () => {
  it('returns sorted variant playlists with parsed resolution metadata', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720',
            '720p/streaminglist-720p.m3u8',
            '#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480',
            '480p/streaminglist-480p.m3u8',
          ].join('\n'),
        });
      }

      throw new Error(`unexpected url: ${url}`);
    });

    await expect(
      fetchGatewayVariantPlaylists('https://example.com/ipfs/', 'bafy123', {
        fetchImpl,
      })
    ).resolves.toEqual([
      {
        url: 'https://example.com/ipfs/bafy123/480p/streaminglist-480p.m3u8',
        bandwidth: 1500000,
        width: 854,
        height: 480,
      },
      {
        url: 'https://example.com/ipfs/bafy123/720p/streaminglist-720p.m3u8',
        bandwidth: 3000000,
        width: 1280,
        height: 720,
      },
    ]);
  });

  it('returns an empty list for media playlists without variant entries', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://example.com/ipfs/bafy123/index.m3u8') {
        return createResponse({
          text: '#EXTM3U\n#EXTINF:5.0,\nsegment_000.ts\n',
        });
      }

      throw new Error(`unexpected url: ${url}`);
    });

    await expect(
      fetchGatewayVariantPlaylists('https://example.com/ipfs/', 'bafy123', {
        fetchImpl,
      })
    ).resolves.toEqual([]);
  });
});
