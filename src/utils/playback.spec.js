import { describe, it, expect } from 'vitest';
import {
  applyPlaybackHotkey,
  clampSeekTime,
  getPlaybackHotkeyAction,
  getCurrentPlaybackTime,
  getPlayerPlaybackSnapshot,
  getPlaybackSnapshot,
  shouldIgnorePlaybackHotkey,
} from './playback';

describe('getCurrentPlaybackTime', () => {
  it('returns 0 when no window', () => {
    expect(getCurrentPlaybackTime(null)).toBe(0);
  });

  it('prefers video.js player time when available', () => {
    const win = {
      videojs: {
        getAllPlayers() {
          return [{ currentTime: () => 123.9 }];
        },
      },
      document: {
        querySelector() {
          return { currentTime: 45 };
        },
      },
    };

    expect(getCurrentPlaybackTime(win)).toBe(123);
  });

  it('falls back to HTML video element time', () => {
    const win = {
      document: {
        querySelector() {
          return { currentTime: 9.2 };
        },
      },
    };

    expect(getCurrentPlaybackTime(win)).toBe(9);
  });

  it('normalizes invalid values to 0', () => {
    const win = {
      videojs: {
        getAllPlayers() {
          return [{ currentTime: () => NaN }];
        },
      },
      document: {
        querySelector() {
          return { currentTime: -5 };
        },
      },
    };

    expect(getCurrentPlaybackTime(win)).toBe(0);
  });
});

describe('getPlaybackSnapshot', () => {
  it('returns time and playing state from video.js player', () => {
    const win = {
      videojs: {
        getAllPlayers() {
          return [{ currentTime: () => 88.7, duration: () => 120.3, paused: () => false, ended: () => false }];
        },
      },
    };

    expect(getPlaybackSnapshot(win)).toEqual({
      time: 88,
      duration: 120,
      isPlaying: true,
      hasEnded: false,
    });
  });

  it('falls back to HTML video playback state', () => {
    const win = {
      document: {
        querySelector() {
          return { currentTime: 12.9, duration: 90.8, paused: true, ended: false };
        },
      },
    };

    expect(getPlaybackSnapshot(win)).toEqual({
      time: 12,
      duration: 90,
      isPlaying: false,
      hasEnded: false,
    });
  });

  it('normalizes missing state to stopped snapshot', () => {
    expect(getPlaybackSnapshot(null)).toEqual({
      time: 0,
      duration: 0,
      isPlaying: false,
      hasEnded: false,
    });
  });
});

describe('getPlayerPlaybackSnapshot', () => {
  it('includes duration and ended state for player-driven persistence', () => {
    expect(
      getPlayerPlaybackSnapshot({
        currentTime: () => 102.4,
        duration: () => 102.9,
        paused: () => true,
        ended: () => true,
      })
    ).toEqual({
      time: 102,
      duration: 102,
      isPlaying: false,
      hasEnded: true,
    });
  });
});

describe('clampSeekTime', () => {
  it('clamps backward seeks to zero', () => {
    expect(clampSeekTime(3, 120, -5)).toBe(0);
  });

  it('clamps forward seeks to the media duration', () => {
    expect(clampSeekTime(118, 120, 5)).toBe(120);
  });

  it('returns the shifted time when duration is unavailable', () => {
    expect(clampSeekTime(20, Number.NaN, 5)).toBe(25);
  });

  it('returns null when current time is invalid', () => {
    expect(clampSeekTime(Number.NaN, 120, 5)).toBeNull();
  });
});

describe('shouldIgnorePlaybackHotkey', () => {
  it('ignores modified or prevented keyboard events', () => {
    expect(shouldIgnorePlaybackHotkey({ ctrlKey: true })).toBe(true);
    expect(shouldIgnorePlaybackHotkey({ defaultPrevented: true })).toBe(true);
  });

  it('ignores editable targets', () => {
    expect(shouldIgnorePlaybackHotkey({ target: { tagName: 'INPUT' } })).toBe(true);
    expect(shouldIgnorePlaybackHotkey({ target: { isContentEditable: true } })).toBe(true);
    expect(
      shouldIgnorePlaybackHotkey({
        target: {
          closest: () => ({}),
        },
      })
    ).toBe(true);
  });

  it('allows non-interactive targets', () => {
    expect(
      shouldIgnorePlaybackHotkey({
        target: {
          tagName: 'DIV',
          closest: () => null,
        },
      })
    ).toBe(false);
  });
});

describe('getPlaybackHotkeyAction', () => {
  it('maps left and right arrows to seek actions', () => {
    expect(
      getPlaybackHotkeyAction({
        key: 'ArrowLeft',
        target: { tagName: 'DIV', closest: () => null },
      })
    ).toEqual({ type: 'seek', deltaSeconds: -5 });

    expect(
      getPlaybackHotkeyAction({
        key: 'ArrowRight',
        target: { tagName: 'DIV', closest: () => null },
      })
    ).toEqual({ type: 'seek', deltaSeconds: 5 });
  });

  it('maps space to playback toggle actions', () => {
    expect(
      getPlaybackHotkeyAction({
        key: ' ',
        target: { tagName: 'DIV', closest: () => null },
      })
    ).toEqual({ type: 'toggle-playback' });

    expect(
      getPlaybackHotkeyAction({
        code: 'Space',
        target: { tagName: 'DIV', closest: () => null },
      })
    ).toEqual({ type: 'toggle-playback' });
  });

  it('returns null for unsupported keys or ignored targets', () => {
    expect(
      getPlaybackHotkeyAction({
        key: 'Enter',
        target: { tagName: 'DIV', closest: () => null },
      })
    ).toBeNull();

    expect(
      getPlaybackHotkeyAction({
        key: ' ',
        target: { tagName: 'INPUT' },
      })
    ).toBeNull();
  });
});

describe('applyPlaybackHotkey', () => {
  function createPlayer(initialTime, duration = 120) {
    let current = initialTime;
    let paused = true;
    let played = 0;
    let pausedCalls = 0;

    return {
      get time() {
        return current;
      },
      get isPaused() {
        return paused;
      },
      get playCalls() {
        return played;
      },
      get pauseCalls() {
        return pausedCalls;
      },
      duration() {
        return duration;
      },
      currentTime(nextTime) {
        if (typeof nextTime === 'number') {
          current = nextTime;
        }
        return current;
      },
      paused() {
        return paused;
      },
      play() {
        played += 1;
        paused = false;
        return Promise.resolve();
      },
      pause() {
        pausedCalls += 1;
        paused = true;
      },
    };
  }

  function createKeyboardEvent(key, target = { tagName: 'DIV', closest: () => null }) {
    let defaultPrevented = false;

    return {
      event: {
        key,
        target,
        preventDefault() {
          defaultPrevented = true;
        },
      },
      wasPrevented() {
        return defaultPrevented;
      },
    };
  }

  it('seeks forward by 5 seconds on ArrowRight', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent('ArrowRight');

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.time).toBe(15);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('seeks backward by 5 seconds on ArrowLeft and clamps to zero', () => {
    const player = createPlayer(3, 120);
    const keyboard = createKeyboardEvent('ArrowLeft');

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.time).toBe(0);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('ignores hotkeys when focus is inside editable controls', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent('ArrowRight', { tagName: 'INPUT' });

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(false);
    expect(player.time).toBe(10);
    expect(keyboard.wasPrevented()).toBe(false);
  });

  it('plays when pressing Space on a paused player', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent(' ');

    expect(player.isPaused).toBe(true);
    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.isPaused).toBe(false);
    expect(player.playCalls).toBe(1);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('pauses when pressing Space on a playing player', () => {
    const player = createPlayer(10, 120);
    const startPlayback = createKeyboardEvent(' ');
    const pausePlayback = createKeyboardEvent(' ');

    applyPlaybackHotkey(startPlayback.event, player);

    expect(applyPlaybackHotkey(pausePlayback.event, player)).toBe(true);
    expect(player.isPaused).toBe(true);
    expect(player.pauseCalls).toBe(1);
    expect(pausePlayback.wasPrevented()).toBe(true);
  });
});
