import { describe, expect, it } from 'vitest';
import {
  buildQualityLevelPayload,
  formatQualitySelectorLabel,
  getStartupInitialRenditionCount,
  pickStartupInitialPlaylist,
  startupInitialRenditionCountFast,
  startupInitialRenditionCountSlow,
  startupInitialRenditionCountSmooth,
} from './startupRenditions';

describe('getStartupInitialRenditionCount', () => {
  it('defaults to the safest startup tier when playback rate is unknown', () => {
    expect(getStartupInitialRenditionCount(Number.NaN)).toBe(startupInitialRenditionCountSlow);
  });

  it('allows one extra rendition when warmup is comfortably above realtime', () => {
    expect(getStartupInitialRenditionCount(1.9)).toBe(startupInitialRenditionCountSmooth);
  });

  it('allows up to the lowest three renditions when warmup is very fast', () => {
    expect(getStartupInitialRenditionCount(3.2)).toBe(startupInitialRenditionCountFast);
  });
});

describe('pickStartupInitialPlaylist', () => {
  const playlists = [
    {
      id: '720p',
      attributes: {
        BANDWIDTH: 3000000,
        RESOLUTION: { width: 1280, height: 720 },
      },
    },
    {
      id: '480p',
      attributes: {
        BANDWIDTH: 1500000,
        RESOLUTION: { width: 854, height: 480 },
      },
    },
    {
      id: '1080p',
      attributes: {
        BANDWIDTH: 5300000,
        RESOLUTION: { width: 1920, height: 1080 },
      },
    },
  ];

  it('picks the lowest available playlist by default', () => {
    expect(pickStartupInitialPlaylist(playlists, 1)).toMatchObject({ id: '480p' });
  });

  it('picks the second-lowest playlist when one extra startup tier is allowed', () => {
    expect(pickStartupInitialPlaylist(playlists, 2)).toMatchObject({ id: '720p' });
  });

  it('skips disabled or temporarily excluded playlists', () => {
    const now = 1000;
    const result = pickStartupInitialPlaylist(
      [
        {
          id: '480p',
          disabled: true,
          attributes: {
            BANDWIDTH: 1500000,
            RESOLUTION: { width: 854, height: 480 },
          },
        },
        {
          id: '720p',
          excludeUntil: now + 100,
          attributes: {
            BANDWIDTH: 3000000,
            RESOLUTION: { width: 1280, height: 720 },
          },
        },
        playlists[2],
      ],
      2,
      { nowFn: () => now }
    );

    expect(result).toMatchObject({ id: '1080p' });
  });
});

describe('formatQualitySelectorLabel', () => {
  it('shows the concrete active quality while auto mode is selected', () => {
    const qualityLevels = {
      length: 3,
      0: { id: '1080p', width: 1920, height: 1080, bandwidth: 5300000, enabled: true },
      1: { id: '480p', width: 854, height: 480, bandwidth: 1500000, enabled: true },
      2: { id: '720p', width: 1280, height: 720, bandwidth: 3000000, enabled: true },
      selectedIndex: 2,
    };

    expect(formatQualitySelectorLabel(qualityLevels)).toBe('Auto · 720p');
  });

  it('shows the pinned quality when manual selection leaves only one rendition enabled', () => {
    const qualityLevels = {
      length: 2,
      0: { id: '480p', width: 854, height: 480, bandwidth: 1500000, enabled: true },
      1: { id: '720p', width: 1280, height: 720, bandwidth: 3000000, enabled: false },
      selectedIndex: 0,
    };

    expect(formatQualitySelectorLabel(qualityLevels)).toBe('480p');
  });
});

describe('buildQualityLevelPayload', () => {
  it('returns a sorted payload that is safe to emit to the app shell', () => {
    const payload = buildQualityLevelPayload({
      length: 2,
      0: { id: '720p', width: 1280, height: 720, bandwidth: 3000000, enabled: false },
      1: { id: '480p', width: 854, height: 480, bandwidth: 1500000, enabled: true },
    });

    expect(payload).toEqual([
      {
        id: '480p',
        label: '480p',
        width: 854,
        height: 480,
        bandwidth: 1500000,
        enabled: true,
      },
      {
        id: '720p',
        label: '720p',
        width: 1280,
        height: 720,
        bandwidth: 3000000,
        enabled: false,
      },
    ]);
  });
});
