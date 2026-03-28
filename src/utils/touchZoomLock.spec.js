import { describe, expect, it } from 'vitest';
import {
  applyTouchViewportLock,
  buildLockedViewportContent,
  isTouchCapableDevice,
  lockTouchDeviceZoom,
  shouldPreventTouchZoom,
} from './touchZoomLock';

function createMetaElement(initialContent = '') {
  return {
    attributes: {
      content: initialContent,
      name: 'viewport',
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

function createFakeDocument({ metaContent = 'width=device-width, initial-scale=1.0', includeMeta = true } = {}) {
  let viewportMeta = includeMeta ? createMetaElement(metaContent) : null;
  const listeners = new Map();

  return {
    head: {
      appendChild(node) {
        viewportMeta = node;
      },
    },
    querySelector(selector) {
      if (selector === 'meta[name="viewport"]') {
        return viewportMeta;
      }

      return null;
    },
    createElement() {
      return createMetaElement();
    },
    addEventListener(type, handler, options) {
      const handlers = listeners.get(type) || [];
      handlers.push({ handler, options });
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      listeners.set(
        type,
        handlers.filter((entry) => entry.handler !== handler)
      );
    },
    __getListeners(type) {
      return listeners.get(type) || [];
    },
    __getViewportMeta() {
      return viewportMeta;
    },
  };
}

function createFakeEvent(overrides = {}) {
  return {
    cancelable: true,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides,
  };
}

describe('isTouchCapableDevice', () => {
  it('prefers maxTouchPoints when available', () => {
    expect(
      isTouchCapableDevice({
        navigator: { maxTouchPoints: 5 },
        window: {},
      })
    ).toBe(true);
  });

  it('falls back to coarse pointer media queries when touch points are unavailable', () => {
    expect(
      isTouchCapableDevice({
        navigator: {},
        window: {
          matchMedia(query) {
            return {
              matches: query === '(any-pointer: coarse)',
            };
          },
        },
      })
    ).toBe(true);
  });

  it('keeps non-touch devices unlocked', () => {
    expect(
      isTouchCapableDevice({
        navigator: { maxTouchPoints: 0 },
        window: {
          matchMedia() {
            return {
              matches: false,
            };
          },
        },
      })
    ).toBe(false);
  });
});

describe('buildLockedViewportContent', () => {
  it('preserves non-scale tokens while forcing a locked zoom viewport', () => {
    expect(buildLockedViewportContent('width=device-width, initial-scale=2, viewport-fit=cover, user-scalable=yes')).toBe(
      'width=device-width, viewport-fit=cover, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no'
    );
  });

  it('adds a sane default width token when the source viewport is missing one', () => {
    expect(buildLockedViewportContent('viewport-fit=cover')).toBe(
      'width=device-width, viewport-fit=cover, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no'
    );
  });
});

describe('shouldPreventTouchZoom', () => {
  it('blocks multitouch and scaled move events while allowing single-touch scroll', () => {
    expect(shouldPreventTouchZoom(createFakeEvent({ touches: [{}, {}] }))).toBe(true);
    expect(shouldPreventTouchZoom(createFakeEvent({ scale: 1.2 }))).toBe(true);
    expect(shouldPreventTouchZoom(createFakeEvent({ touches: [{}] }))).toBe(false);
  });
});

describe('applyTouchViewportLock', () => {
  it('creates a viewport meta tag when one does not exist', () => {
    const documentRef = createFakeDocument({
      includeMeta: false,
    });

    const viewportMeta = applyTouchViewportLock(documentRef);

    expect(viewportMeta?.getAttribute('content')).toBe(
      'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no'
    );
    expect(documentRef.__getViewportMeta()).toBe(viewportMeta);
  });
});

describe('lockTouchDeviceZoom', () => {
  it('locks the viewport and registers pinch guards on touch-capable devices', () => {
    const documentRef = createFakeDocument();
    const cleanup = lockTouchDeviceZoom({
      document: documentRef,
      navigator: { maxTouchPoints: 2 },
      window: {},
    });

    expect(documentRef.__getViewportMeta()?.getAttribute('content')).toBe(
      'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no'
    );
    expect(documentRef.__getListeners('touchmove')).toHaveLength(1);
    expect(documentRef.__getListeners('gesturestart')).toHaveLength(1);
    expect(documentRef.__getListeners('gesturechange')).toHaveLength(1);
    expect(documentRef.__getListeners('gestureend')).toHaveLength(1);

    const multitouchMove = createFakeEvent({
      touches: [{}, {}],
    });
    documentRef.__getListeners('touchmove')[0].handler(multitouchMove);
    expect(multitouchMove.defaultPrevented).toBe(true);

    const singleTouchMove = createFakeEvent({
      touches: [{}],
    });
    documentRef.__getListeners('touchmove')[0].handler(singleTouchMove);
    expect(singleTouchMove.defaultPrevented).toBe(false);

    cleanup();

    expect(documentRef.__getListeners('touchmove')).toHaveLength(0);
    expect(documentRef.__getListeners('gesturestart')).toHaveLength(0);
  });

  it('does not change non-touch devices', () => {
    const documentRef = createFakeDocument();
    const cleanup = lockTouchDeviceZoom({
      document: documentRef,
      navigator: { maxTouchPoints: 0 },
      window: {
        matchMedia() {
          return {
            matches: false,
          };
        },
      },
    });

    expect(documentRef.__getViewportMeta()?.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
    expect(documentRef.__getListeners('touchmove')).toHaveLength(0);

    cleanup();
  });
});
