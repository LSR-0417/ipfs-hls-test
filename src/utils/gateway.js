export const gatewayStorageKey = 'ipfs-hls-selected-gateway';

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

export function readStoredGateway(target) {
  const storage = resolveStorage(target);
  if (!storage) return '';

  try {
    const value = storage.getItem(gatewayStorageKey);
    return typeof value === 'string' ? value.trim() : '';
  } catch (_) {
    return '';
  }
}

export function persistGateway(gateway, target) {
  const storage = resolveStorage(target);
  if (!storage) return;

  const normalized = typeof gateway === 'string' ? gateway.trim() : '';

  try {
    if (normalized) {
      storage.setItem(gatewayStorageKey, normalized);
      return;
    }

    if (typeof storage.removeItem === 'function') {
      storage.removeItem(gatewayStorageKey);
    }
  } catch (_) {
    // ignore storage errors
  }
}
