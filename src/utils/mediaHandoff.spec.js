import { describe, expect, it, vi } from 'vitest';
import {
  applyQualityLevelHeightLock,
  buildMediaHandoffQualitySnapshot,
  clearRecoverableMediaPlaylistExclusions,
  classifyMediaHandoffRequestKind,
  isSuccessfulMediaHandoffSegmentResponse,
  mediaHandoffQualityModeAuto,
  mediaHandoffQualityModeManual,
  mediaHandoffRequestKindManifest,
  mediaHandoffRequestKindSegment,
  resumeMediaHandoffPlayback,
  rewriteMediaHandoffRequestUri,
  selectMediaHandoffLockedHeight,
} from './mediaHandoff';

describe('buildMediaHandoffQualitySnapshot', () => {
  it('treats fully enabled levels as auto mode and uses the active rendition height', () => {
    const qualityLevels = {
      length: 3,
      selectedIndex: 2,
      0: { width: 854, height: 480, enabled: true },
      1: { width: 1280, height: 720, enabled: true },
      2: { width: 1920, height: 1080, enabled: true },
    };

    expect(buildMediaHandoffQualitySnapshot(qualityLevels)).toEqual({
      mode: mediaHandoffQualityModeAuto,
      activeHeight: 1080,
      lockedHeight: 1080,
      allHeights: [480, 720, 1080],
      enabledHeights: [480, 720, 1080],
    });
  });

  it('treats partially enabled levels as manual mode and preserves the pinned quality', () => {
    const qualityLevels = {
      length: 3,
      selectedIndex: 1,
      0: { width: 854, height: 480, enabled: false },
      1: { width: 1280, height: 720, enabled: true },
      2: { width: 1920, height: 1080, enabled: false },
    };

    expect(buildMediaHandoffQualitySnapshot(qualityLevels)).toEqual({
      mode: mediaHandoffQualityModeManual,
      activeHeight: 720,
      lockedHeight: 720,
      allHeights: [480, 720, 1080],
      enabledHeights: [720],
    });
  });
});

describe('selectMediaHandoffLockedHeight', () => {
  it('prefers the exact same resolution when available', () => {
    expect(
      selectMediaHandoffLockedHeight(
        {
          mode: mediaHandoffQualityModeManual,
          activeHeight: 720,
          lockedHeight: 720,
        },
        [480, 720, 1080]
      )
    ).toBe(720);
  });

  it('falls back to the nearest lower resolution before trying a higher one', () => {
    expect(
      selectMediaHandoffLockedHeight(
        {
          mode: mediaHandoffQualityModeAuto,
          activeHeight: 720,
          lockedHeight: 720,
        },
        [360, 480, 1080]
      )
    ).toBe(480);
  });

  it('uses the nearest higher resolution only when no lower one exists', () => {
    expect(
      selectMediaHandoffLockedHeight(
        {
          mode: mediaHandoffQualityModeManual,
          activeHeight: 480,
          lockedHeight: 480,
        },
        [720, 1080]
      )
    ).toBe(720);
  });
});

describe('applyQualityLevelHeightLock', () => {
  it('pins the matching quality level height', () => {
    const qualityLevels = {
      length: 3,
      0: { width: 854, height: 480, enabled: true },
      1: { width: 1280, height: 720, enabled: true },
      2: { width: 1920, height: 1080, enabled: true },
    };

    expect(applyQualityLevelHeightLock(qualityLevels, 720)).toBe(true);
    expect(qualityLevels[0].enabled).toBe(false);
    expect(qualityLevels[1].enabled).toBe(true);
    expect(qualityLevels[2].enabled).toBe(false);
  });

  it('releases the lock back to auto by enabling every level', () => {
    const qualityLevels = {
      length: 2,
      0: { width: 854, height: 480, enabled: false },
      1: { width: 1280, height: 720, enabled: true },
    };

    expect(applyQualityLevelHeightLock(qualityLevels, mediaHandoffQualityModeAuto)).toBe(true);
    expect(qualityLevels[0].enabled).toBe(true);
    expect(qualityLevels[1].enabled).toBe(true);
  });
});

describe('rewriteMediaHandoffRequestUri', () => {
  it('rewrites HLS request paths to the selected gateway while preserving the asset path', () => {
    expect(
      rewriteMediaHandoffRequestUri('https://old.example/ipfs/bafy123/720p/segment_001.ts?token=1', {
        cid: 'bafy123',
        gateway: 'https://new.example/ipfs/',
      })
    ).toBe('https://new.example/ipfs/bafy123/720p/segment_001.ts?token=1');
  });

  it('returns empty string when the request does not belong to the active cid', () => {
    expect(
      rewriteMediaHandoffRequestUri('https://old.example/ipfs/other/segment_001.ts', {
        cid: 'bafy123',
        gateway: 'https://new.example/ipfs/',
      })
    ).toBe('');
  });
});

describe('classifyMediaHandoffRequestKind', () => {
  it('distinguishes manifest and segment requests', () => {
    expect(classifyMediaHandoffRequestKind('https://example.com/ipfs/bafy123/index.m3u8')).toBe(
      mediaHandoffRequestKindManifest
    );
    expect(classifyMediaHandoffRequestKind('https://example.com/ipfs/bafy123/720p/segment_001.ts')).toBe(
      mediaHandoffRequestKindSegment
    );
  });
});

describe('isSuccessfulMediaHandoffSegmentResponse', () => {
  it('accepts successful target-gateway segment responses', () => {
    expect(
      isSuccessfulMediaHandoffSegmentResponse(
        {
          uri: 'https://new.example/ipfs/bafy123/720p/segment_001.ts',
        },
        null,
        {
          statusCode: 200,
        },
        {
          cid: 'bafy123',
          gateway: 'https://new.example/ipfs/',
        }
      )
    ).toBe(true);
  });

  it('ignores manifest requests and failed responses', () => {
    expect(
      isSuccessfulMediaHandoffSegmentResponse(
        {
          uri: 'https://new.example/ipfs/bafy123/index.m3u8',
        },
        null,
        {
          statusCode: 200,
        },
        {
          cid: 'bafy123',
          gateway: 'https://new.example/ipfs/',
        }
      )
    ).toBe(false);

    expect(
      isSuccessfulMediaHandoffSegmentResponse(
        {
          uri: 'https://new.example/ipfs/bafy123/720p/segment_001.ts',
        },
        null,
        {
          statusCode: 404,
        },
        {
          cid: 'bafy123',
          gateway: 'https://new.example/ipfs/',
        }
      )
    ).toBe(false);
  });
});

describe('clearRecoverableMediaPlaylistExclusions', () => {
  it('clears gateway-recoverable exclusions but keeps non-usable ones', () => {
    const playlists = [
      { id: '480p', excludeUntil: Date.now() + 1000, lastExcludeReason_: 'network' },
      { id: '720p', excludeUntil: Infinity, lastExcludeReason_: 'non-usable' },
      { id: '1080p', excludeUntil: Infinity, lastExcludeReason_: 'playlist-unchanged' },
    ];

    expect(clearRecoverableMediaPlaylistExclusions(playlists)).toBe(2);
    expect(playlists[0]).not.toHaveProperty('excludeUntil');
    expect(playlists[0]).not.toHaveProperty('lastExcludeReason_');
    expect(playlists[1]).toMatchObject({
      excludeUntil: Infinity,
      lastExcludeReason_: 'non-usable',
    });
    expect(playlists[2]).not.toHaveProperty('excludeUntil');
    expect(playlists[2]).not.toHaveProperty('lastExcludeReason_');
  });
});

describe('resumeMediaHandoffPlayback', () => {
  it('clears the player error, re-enables playlists, and restarts loading', () => {
    let currentError = { code: 2 };
    const playlistController = {
      error: { code: 2 },
      mainPlaylistLoader_: {
        error: { code: 2 },
        main: {
          playlists: [
            { id: '480p', excludeUntil: Date.now() + 1000, lastExcludeReason_: 'network' },
            { id: '720p', excludeUntil: Infinity, lastExcludeReason_: 'non-usable' },
          ],
        },
        load: vi.fn(),
      },
      mainSegmentLoader_: {
        error: vi.fn(),
      },
      audioSegmentLoader_: {
        error: vi.fn(),
      },
      subtitleSegmentLoader_: {
        error: vi.fn(),
      },
      load: vi.fn(),
      play: vi.fn(),
    };
    const player = {
      error: vi.fn(function setOrGetError(value) {
        if (arguments.length > 0) {
          currentError = value;
          return currentError;
        }

        return currentError;
      }),
      tech: () => ({
        vhs: {
          playlistController_: playlistController,
        },
      }),
    };

    const result = resumeMediaHandoffPlayback(player, { shouldAutoplay: false });

    expect(result).toEqual({
      didClearError: true,
      reincludedPlaylistCount: 1,
      didResumeLoading: true,
    });
    expect(player.error).toHaveBeenCalledWith(null);
    expect(playlistController.mainPlaylistLoader_.load).toHaveBeenCalledTimes(1);
    expect(playlistController.load).toHaveBeenCalledTimes(1);
    expect(playlistController.play).not.toHaveBeenCalled();
    expect(playlistController.mainSegmentLoader_.error).toHaveBeenCalledWith(null);
  });

  it('uses play() when autoplay intent should be preserved', () => {
    const playlistController = {
      mainPlaylistLoader_: {
        main: {
          playlists: [],
        },
        load: vi.fn(),
      },
      mainSegmentLoader_: {
        error: vi.fn(),
      },
      load: vi.fn(),
      play: vi.fn(),
    };
    const player = {
      error: vi.fn(() => null),
      tech: () => ({
        vhs: {
          playlistController_: playlistController,
        },
      }),
    };

    const result = resumeMediaHandoffPlayback(player, { shouldAutoplay: true });

    expect(result).toEqual({
      didClearError: false,
      reincludedPlaylistCount: 0,
      didResumeLoading: true,
    });
    expect(playlistController.mainPlaylistLoader_.load).toHaveBeenCalledTimes(1);
    expect(playlistController.play).toHaveBeenCalledTimes(1);
    expect(playlistController.load).not.toHaveBeenCalled();
  });
});
