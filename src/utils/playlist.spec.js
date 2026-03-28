import { describe, expect, it, vi } from 'vitest';
import {
  buildPlayableEpisodeCid,
  buildSeriesEpisodeCid,
  checkDirectVideoAvailability,
  fetchPlaylistManifest,
  isValidPlaylistManifest,
  normalizeEpisodePath,
  normalizePlaylistManifest,
  resolveFirstPlayableEpisode,
  resolveSelectedPlaylistEpisode,
} from './playlist';

function createHeaders(values = {}) {
  const entries = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));

  return {
    get(name) {
      return entries.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function createJsonResponse(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: createHeaders({
      'content-type': options.contentType ?? 'application/json',
    }),
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

describe('normalizeEpisodePath', () => {
  it('trims leading and trailing slashes', () => {
    expect(normalizeEpisodePath('/ep01/')).toBe('ep01');
    expect(normalizeEpisodePath(' season-1/ep02/ ')).toBe('season-1/ep02');
  });
});

describe('normalizePlaylistManifest', () => {
  it('normalizes playlist payloads into a stable contract shape', () => {
    expect(
      normalizePlaylistManifest({
        version: '1',
        title: ' Demo Series ',
        episodes: [
          {
            id: ' ep01 ',
            cid: ' /ipfs/bafy-ep01/ ',
            number: '1',
            title: ' Episode 1 ',
            uploader: ' Demo Channel ',
            duration_string: ' 12:34 ',
            path: '/ep01/',
            playable: true,
          },
        ],
      })
    ).toEqual({
      version: 1,
      title: 'Demo Series',
      episodes: [
        {
          id: 'ep01',
          cid: 'bafy-ep01',
          number: 1,
          title: 'Episode 1',
          uploader: 'Demo Channel',
          durationString: '12:34',
          path: 'ep01',
          playable: true,
        },
      ],
    });
  });
});

describe('isValidPlaylistManifest', () => {
  it('accepts the minimum v1 contract', () => {
    expect(
      isValidPlaylistManifest({
        version: 1,
        title: 'Series Title',
        episodes: [
          {
            id: 'ep01',
            cid: 'bafy-ep01',
            number: 1,
            title: 'Episode 1',
            uploader: 'Demo Channel',
            durationString: '12:34',
            path: 'ep01',
            playable: true,
          },
        ],
      })
    ).toBe(true);
  });

  it('rejects playlists that miss required episode fields', () => {
    expect(
      isValidPlaylistManifest({
        version: 1,
        title: 'Broken Series',
        episodes: [
          {
            id: 'ep01',
            number: 1,
            title: '',
            path: 'ep01',
            playable: true,
          },
        ],
      })
    ).toBe(false);
  });

  it('accepts episodes that provide a standalone cid instead of a relative path', () => {
    expect(
      isValidPlaylistManifest({
        version: 1,
        title: 'CID Series',
        episodes: [
          {
            id: 'ep01',
            cid: 'bafy-ep01',
            number: 1,
            title: 'Episode 1',
            path: '',
            playable: true,
          },
        ],
      })
    ).toBe(true);
  });
});

describe('resolveFirstPlayableEpisode', () => {
  it('returns the first playable episode', () => {
    const playlist = normalizePlaylistManifest({
      version: 1,
      title: 'Demo Series',
      episodes: [
        { id: 'ep01', number: 1, title: 'Episode 1', path: 'ep01', playable: false },
        { id: 'ep02', number: 2, title: 'Episode 2', path: 'ep02', playable: true },
      ],
    });

    expect(resolveFirstPlayableEpisode(playlist)).toEqual({
      id: 'ep02',
      cid: '',
      number: 2,
      title: 'Episode 2',
      uploader: '',
      durationString: '',
      path: 'ep02',
      playable: true,
    });
  });
});

describe('resolveSelectedPlaylistEpisode', () => {
  it('prefers the requested playable path and falls back to the first playable episode', () => {
    const playlist = normalizePlaylistManifest({
      version: 1,
      title: 'Demo Series',
      episodes: [
        { id: 'ep01', number: 1, title: 'Episode 1', path: 'ep01', playable: true },
        { id: 'ep02', number: 2, title: 'Episode 2', path: 'ep02', playable: true },
      ],
    });

    expect(resolveSelectedPlaylistEpisode(playlist, 'ep02')?.id).toBe('ep02');
    expect(resolveSelectedPlaylistEpisode(playlist, 'missing')?.id).toBe('ep01');
  });
});

describe('buildSeriesEpisodeCid', () => {
  it('builds a nested playable CID path from a series root and episode path', () => {
    expect(buildSeriesEpisodeCid('bafy-series', '/ep01/')).toBe('bafy-series/ep01');
  });
});

describe('buildPlayableEpisodeCid', () => {
  it('prefers the explicit episode cid and falls back to the series path', () => {
    expect(buildPlayableEpisodeCid('bafy-series', { cid: 'bafy-episode' })).toBe('bafy-episode');
    expect(buildPlayableEpisodeCid('bafy-series', { path: '/ep01/' })).toBe('bafy-series/ep01');
  });
});

describe('fetchPlaylistManifest', () => {
  it('returns an ok result for a valid playlist manifest', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createJsonResponse({
        version: 1,
        title: 'Demo Series',
        episodes: [
          {
            id: 'ep01',
            cid: 'bafy-ep01',
            number: 1,
            title: 'Episode 1',
            uploader: 'Demo Channel',
            durationString: '12:34',
            path: 'ep01',
            playable: true,
          },
        ],
      })
    );

    await expect(fetchPlaylistManifest('bafy-series', 'https://dweb.link/ipfs/', { fetchImpl })).resolves.toEqual({
      status: 'ok',
      playlist: {
        version: 1,
        title: 'Demo Series',
        episodes: [
          {
            id: 'ep01',
            cid: 'bafy-ep01',
            number: 1,
            title: 'Episode 1',
            uploader: 'Demo Channel',
            durationString: '12:34',
            path: 'ep01',
            playable: true,
          },
        ],
      },
      detail: '',
    });
  });

  it('treats a 404 playlist as missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createJsonResponse({}, { ok: false, status: 404 }));

    await expect(fetchPlaylistManifest('bafy-series', 'https://dweb.link/ipfs/', { fetchImpl })).resolves.toEqual({
      status: 'missing',
      playlist: null,
      detail: '找不到 playlist.json',
    });
  });

  it('rejects playlists that return HTML or invalid structure', async () => {
    const htmlFetch = vi.fn().mockResolvedValue(createJsonResponse({}, { contentType: 'text/html' }));
    const invalidFetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        version: 1,
        title: 'Broken',
        episodes: [{ id: 'ep01', number: 1, title: '', path: 'ep01', playable: true }],
      })
    );

    await expect(fetchPlaylistManifest('bafy-series', 'https://dweb.link/ipfs/', { fetchImpl: htmlFetch })).resolves.toEqual({
      status: 'invalid',
      playlist: null,
      detail: 'playlist.json 回傳了 HTML 內容',
    });
    await expect(fetchPlaylistManifest('bafy-series', 'https://dweb.link/ipfs/', { fetchImpl: invalidFetch })).resolves.toEqual({
      status: 'invalid',
      playlist: null,
      detail: 'playlist.json 缺少必要欄位或格式不正確',
    });
  });
});

describe('checkDirectVideoAvailability', () => {
  it('returns true only when the index.m3u8 request succeeds', async () => {
    const successFetch = vi.fn().mockResolvedValue({ ok: true });
    const failureFetch = vi.fn().mockResolvedValue({ ok: false });

    await expect(checkDirectVideoAvailability('bafy-video', 'https://dweb.link/ipfs/', { fetchImpl: successFetch })).resolves.toBe(true);
    await expect(checkDirectVideoAvailability('bafy-video', 'https://dweb.link/ipfs/', { fetchImpl: failureFetch })).resolves.toBe(false);
  });
});
