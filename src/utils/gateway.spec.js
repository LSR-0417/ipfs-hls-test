import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGatewayIndexUrl,
  customGatewayStorageKey,
  gatewayStorageKey,
  isPrivateHostname,
  normalizeGatewayUrl,
  persistCustomGateway,
  persistGateway,
  probeGatewayAvailability,
  readStoredCustomGateway,
  readStoredGateway,
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
});

describe('buildGatewayIndexUrl', () => {
  it('builds the index.m3u8 URL from a gateway base and CID', () => {
    expect(buildGatewayIndexUrl('https://example.com/ipfs/', 'bafy123')).toBe(
      'https://example.com/ipfs/bafy123/index.m3u8'
    );
  });
});

describe('probeGatewayAvailability', () => {
  it('returns ready when index.m3u8 is reachable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const nowFn = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(132);

    await expect(probeGatewayAvailability('https://example.com/ipfs/', 'bafy123', { fetchImpl, nowFn })).resolves.toEqual(
      {
        state: 'ready',
        detail: '已找到 index.m3u8',
        durationMs: 32,
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/index.m3u8',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
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
    });
  });
});
