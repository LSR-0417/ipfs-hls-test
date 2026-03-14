import { describe, it, expect } from 'vitest';
import { getCurrentPlaybackTime, getPlaybackSnapshot } from './playback';

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
