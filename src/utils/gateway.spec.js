import { describe, expect, it } from 'vitest';
import { gatewayStorageKey, persistGateway, readStoredGateway } from './gateway';

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
