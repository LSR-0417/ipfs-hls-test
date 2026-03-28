const VIEWPORT_SELECTOR = 'meta[name="viewport"]';
const SCALE_TOKENS = new Set(['initial-scale', 'minimum-scale', 'maximum-scale', 'user-scalable']);
const PINCH_GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'];
const NON_PASSIVE_LISTENER = { passive: false };

function getViewportTokenKey(token) {
  const [rawKey = ''] = token.split('=');
  return rawKey.trim().toLowerCase();
}

function readMediaQueryMatch(windowRef, query) {
  if (!windowRef || typeof windowRef.matchMedia !== 'function') {
    return false;
  }

  try {
    return Boolean(windowRef.matchMedia(query)?.matches);
  } catch {
    return false;
  }
}

function ensureViewportMeta(documentRef) {
  if (!documentRef?.querySelector) {
    return null;
  }

  let viewportMeta = documentRef.querySelector(VIEWPORT_SELECTOR);
  if (viewportMeta) {
    return viewportMeta;
  }

  if (!documentRef.createElement || !documentRef.head?.appendChild) {
    return null;
  }

  viewportMeta = documentRef.createElement('meta');
  viewportMeta.setAttribute('name', 'viewport');
  documentRef.head.appendChild(viewportMeta);
  return viewportMeta;
}

function preventIfCancelable(event) {
  if (event?.cancelable) {
    event.preventDefault();
  }
}

export function isTouchCapableDevice({ navigator: navigatorRef, window: windowRef } = {}) {
  if (typeof navigatorRef?.maxTouchPoints === 'number') {
    return navigatorRef.maxTouchPoints > 0;
  }

  return readMediaQueryMatch(windowRef, '(any-pointer: coarse)') || readMediaQueryMatch(windowRef, '(pointer: coarse)');
}

export function buildLockedViewportContent(content = '') {
  const tokens = content
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const preservedTokens = [];
  const preservedKeys = new Set();

  for (const token of tokens) {
    const key = getViewportTokenKey(token);

    if (SCALE_TOKENS.has(key) || preservedKeys.has(key)) {
      continue;
    }

    preservedKeys.add(key);
    preservedTokens.push(token);
  }

  if (!preservedKeys.has('width')) {
    preservedTokens.unshift('width=device-width');
  }

  return [...preservedTokens, 'initial-scale=1', 'minimum-scale=1', 'maximum-scale=1', 'user-scalable=no'].join(', ');
}

export function applyTouchViewportLock(documentRef) {
  const viewportMeta = ensureViewportMeta(documentRef);

  if (!viewportMeta) {
    return null;
  }

  const currentContent = viewportMeta.getAttribute('content') || '';
  viewportMeta.setAttribute('content', buildLockedViewportContent(currentContent));
  return viewportMeta;
}

export function shouldPreventTouchZoom(event) {
  if (!event) {
    return false;
  }

  if (typeof event.scale === 'number' && event.scale !== 1) {
    return true;
  }

  return typeof event.touches?.length === 'number' && event.touches.length > 1;
}

export function lockTouchDeviceZoom({
  window: windowRef = globalThis.window,
  document: documentRef = globalThis.document,
  navigator: navigatorRef = globalThis.navigator,
} = {}) {
  if (!isTouchCapableDevice({ navigator: navigatorRef, window: windowRef })) {
    return () => {};
  }

  applyTouchViewportLock(documentRef);

  if (!documentRef?.addEventListener) {
    return () => {};
  }

  const handleTouchMove = (event) => {
    if (shouldPreventTouchZoom(event)) {
      preventIfCancelable(event);
    }
  };
  const handleGesture = (event) => {
    preventIfCancelable(event);
  };

  documentRef.addEventListener('touchmove', handleTouchMove, NON_PASSIVE_LISTENER);

  for (const eventName of PINCH_GESTURE_EVENTS) {
    documentRef.addEventListener(eventName, handleGesture);
  }

  return () => {
    documentRef.removeEventListener('touchmove', handleTouchMove, NON_PASSIVE_LISTENER);

    for (const eventName of PINCH_GESTURE_EVENTS) {
      documentRef.removeEventListener(eventName, handleGesture);
    }
  };
}
