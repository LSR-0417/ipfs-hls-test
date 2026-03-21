import { describe, expect, it } from 'vitest';
import {
  applyPlaybackHotkey,
  clampSeekTime,
  getPlaybackHotkeyAction,
  getCurrentPlaybackTime,
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
          return [{ currentTime: () => 88.7, paused: () => false }];
        },
      },
    };

    expect(getPlaybackSnapshot(win)).toEqual({
      time: 88,
      isPlaying: true,
    });
  });

  it('falls back to HTML video playback state', () => {
    const win = {
      document: {
        querySelector() {
          return { currentTime: 12.9, paused: true, ended: false };
        },
      },
    };

    expect(getPlaybackSnapshot(win)).toEqual({
      time: 12,
      isPlaying: false,
    });
  });

  it('normalizes missing state to stopped snapshot', () => {
    expect(getPlaybackSnapshot(null)).toEqual({
      time: 0,
      isPlaying: false,
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
  function target() {
    return { tagName: 'DIV', closest: () => null };
  }

  it('maps seek hotkeys for arrows and j/l', () => {
    expect(getPlaybackHotkeyAction({ key: 'ArrowLeft', target: target() })).toEqual({
      type: 'seek',
      deltaSeconds: -5,
    });
    expect(getPlaybackHotkeyAction({ key: 'ArrowRight', target: target() })).toEqual({
      type: 'seek',
      deltaSeconds: 5,
    });
    expect(getPlaybackHotkeyAction({ key: 'j', target: target() })).toEqual({
      type: 'seek',
      deltaSeconds: -10,
    });
    expect(getPlaybackHotkeyAction({ key: 'L', target: target() })).toEqual({
      type: 'seek',
      deltaSeconds: 10,
    });
  });

  it('maps playback, player, subtitle, and help toggles', () => {
    expect(getPlaybackHotkeyAction({ key: ' ', target: target() })).toEqual({ type: 'toggle-playback' });
    expect(getPlaybackHotkeyAction({ code: 'Space', target: target() })).toEqual({ type: 'toggle-playback' });
    expect(getPlaybackHotkeyAction({ key: 'k', target: target() })).toEqual({ type: 'toggle-playback' });
    expect(getPlaybackHotkeyAction({ key: 'm', target: target() })).toEqual({ type: 'toggle-mute' });
    expect(getPlaybackHotkeyAction({ key: 'f', target: target() })).toEqual({ type: 'toggle-fullscreen' });
    expect(getPlaybackHotkeyAction({ key: 'c', target: target() })).toEqual({ type: 'toggle-subtitles' });
    expect(getPlaybackHotkeyAction({ key: '?', target: target() })).toEqual({ type: 'toggle-help' });
  });

  it('maps comma and period to frame-step actions', () => {
    expect(getPlaybackHotkeyAction({ key: ',', code: 'Comma', target: target() })).toEqual({
      type: 'frame-step',
      deltaFrames: -1,
    });
    expect(getPlaybackHotkeyAction({ key: '.', code: 'Period', target: target() })).toEqual({
      type: 'frame-step',
      deltaFrames: 1,
    });
    expect(
      getPlaybackHotkeyAction({
        key: '<',
        code: 'Comma',
        shiftKey: true,
        target: target(),
      })
    ).toBeNull();
  });

  it('supports custom seek step options', () => {
    expect(
      getPlaybackHotkeyAction(
        {
          key: 'ArrowRight',
          target: target(),
        },
        { seekStepSeconds: 7, longSeekStepSeconds: 12 }
      )
    ).toEqual({
      type: 'seek',
      deltaSeconds: 7,
    });
  });

  it('returns null for unsupported keys or ignored targets', () => {
    expect(getPlaybackHotkeyAction({ key: 'Enter', target: target() })).toBeNull();
    expect(getPlaybackHotkeyAction({ key: ' ', target: { tagName: 'INPUT' } })).toBeNull();
  });
});

describe('applyPlaybackHotkey', () => {
  function createPlayer(initialTime, duration = 120, options = {}) {
    let current = initialTime;
    let paused = options.paused ?? true;
    let muted = options.muted ?? false;
    let fullscreen = options.fullscreen ?? false;
    let playCalls = 0;
    let pauseCalls = 0;
    let requestFullscreenCalls = 0;
    let exitFullscreenCalls = 0;

    return {
      get time() {
        return current;
      },
      get isPaused() {
        return paused;
      },
      get isMuted() {
        return muted;
      },
      get isFullscreenState() {
        return fullscreen;
      },
      get playCalls() {
        return playCalls;
      },
      get pauseCalls() {
        return pauseCalls;
      },
      get requestFullscreenCalls() {
        return requestFullscreenCalls;
      },
      get exitFullscreenCalls() {
        return exitFullscreenCalls;
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
        playCalls += 1;
        paused = false;
        return Promise.resolve();
      },
      pause() {
        pauseCalls += 1;
        paused = true;
      },
      muted(nextMuted) {
        if (typeof nextMuted === 'boolean') {
          muted = nextMuted;
        }
        return muted;
      },
      isFullscreen() {
        return fullscreen;
      },
      requestFullscreen() {
        requestFullscreenCalls += 1;
        fullscreen = true;
      },
      exitFullscreen() {
        exitFullscreenCalls += 1;
        fullscreen = false;
      },
    };
  }

  function createKeyboardEvent({ key = '', code = '', shiftKey = false, target = null } = {}) {
    let defaultPrevented = false;

    return {
      event: {
        key,
        code,
        shiftKey,
        target: target || { tagName: 'DIV', closest: () => null },
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
    const keyboard = createKeyboardEvent({ key: 'ArrowRight' });

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.time).toBe(15);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('seeks backward by 10 seconds on j and clamps to zero', () => {
    const player = createPlayer(3, 120);
    const keyboard = createKeyboardEvent({ key: 'j' });

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.time).toBe(0);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('ignores hotkeys when focus is inside editable controls', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent({ key: 'ArrowRight', target: { tagName: 'INPUT' } });

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(false);
    expect(player.time).toBe(10);
    expect(keyboard.wasPrevented()).toBe(false);
  });

  it('plays when pressing Space on a paused player', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent({ key: ' ' });

    expect(player.isPaused).toBe(true);
    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.isPaused).toBe(false);
    expect(player.playCalls).toBe(1);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('pauses when pressing k on a playing player', () => {
    const player = createPlayer(10, 120, { paused: false });
    const keyboard = createKeyboardEvent({ key: 'k' });

    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.isPaused).toBe(true);
    expect(player.pauseCalls).toBe(1);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('toggles mute on m', () => {
    const player = createPlayer(10, 120);
    const keyboard = createKeyboardEvent({ key: 'm' });

    expect(player.isMuted).toBe(false);
    expect(applyPlaybackHotkey(keyboard.event, player)).toBe(true);
    expect(player.isMuted).toBe(true);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('toggles fullscreen on f', () => {
    const player = createPlayer(10, 120);
    const openFullscreen = createKeyboardEvent({ key: 'f' });
    const closeFullscreen = createKeyboardEvent({ key: 'f' });

    expect(applyPlaybackHotkey(openFullscreen.event, player)).toBe(true);
    expect(player.isFullscreenState).toBe(true);
    expect(player.requestFullscreenCalls).toBe(1);

    expect(applyPlaybackHotkey(closeFullscreen.event, player)).toBe(true);
    expect(player.isFullscreenState).toBe(false);
    expect(player.exitFullscreenCalls).toBe(1);
  });

  it('steps frames while paused using the provided frame rate', () => {
    const player = createPlayer(10, 120, { paused: true });
    const keyboard = createKeyboardEvent({ key: '.', code: 'Period' });

    expect(
      applyPlaybackHotkey(keyboard.event, player, {
        frameRate: 20,
      })
    ).toBe(true);
    expect(player.time).toBeCloseTo(10.05, 5);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('does not step frames while the player is still playing', () => {
    const player = createPlayer(10, 120, { paused: false });
    const keyboard = createKeyboardEvent({ key: ',', code: 'Comma' });

    expect(applyPlaybackHotkey(keyboard.event, player, { frameRate: 20 })).toBe(false);
    expect(player.time).toBe(10);
    expect(keyboard.wasPrevented()).toBe(false);
  });

  it('runs the subtitle toggle callback without requiring a player method', () => {
    let toggles = 0;
    const keyboard = createKeyboardEvent({ key: 'c' });

    expect(
      applyPlaybackHotkey(keyboard.event, null, {
        onToggleSubtitles() {
          toggles += 1;
        },
      })
    ).toBe(true);
    expect(toggles).toBe(1);
    expect(keyboard.wasPrevented()).toBe(true);
  });

  it('runs the help toggle callback for question-mark', () => {
    let toggles = 0;
    const keyboard = createKeyboardEvent({ key: '?', code: 'Slash', shiftKey: true });

    expect(
      applyPlaybackHotkey(keyboard.event, null, {
        onToggleHelp() {
          toggles += 1;
        },
      })
    ).toBe(true);
    expect(toggles).toBe(1);
    expect(keyboard.wasPrevented()).toBe(true);
  });
});
