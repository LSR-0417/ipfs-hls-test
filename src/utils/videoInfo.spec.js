import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultVideoInfo,
  fetchVideoInfo,
  formatRelativeUploadTime,
  formatUploadDate,
  formatUploadDateTooltip,
  normalizeVideoInfo,
} from './videoInfo';

function createHeaders(values = {}) {
  const entries = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));

  return {
    get(name) {
      return entries.get(String(name).toLowerCase()) ?? null;
    },
  };
}

describe('createDefaultVideoInfo', () => {
  it('returns an empty metadata object', () => {
    expect(createDefaultVideoInfo()).toEqual({
      id: '',
      title: '',
      uploader: '',
      channelId: '',
      uploadDate: '',
      durationString: '',
      description: '',
      tags: [],
      categories: [],
      resolution: '',
      fps: null,
    });
  });
});

describe('normalizeVideoInfo', () => {
  it('maps the packaged info.json shape into frontend metadata', () => {
    expect(
      normalizeVideoInfo({
        id: 'UdGk5Qv0C1M',
        title: '台灣必須投降！我錯了！',
        uploader: '阿兜仔不教美語',
        channel_id: 'UCYgpfeq5JyEo_pPmu-4VLiA',
        upload_date: '20260307',
        duration_string: '10:16',
        description: 'desc',
        tags: ['中國', '台灣', '', null],
        categories: ['News & Politics'],
        resolution: '1920x1080',
        fps: 30,
      })
    ).toEqual({
      id: 'UdGk5Qv0C1M',
      title: '台灣必須投降！我錯了！',
      uploader: '阿兜仔不教美語',
      channelId: 'UCYgpfeq5JyEo_pPmu-4VLiA',
      uploadDate: '20260307',
      durationString: '10:16',
      description: 'desc',
      tags: ['中國', '台灣'],
      categories: ['News & Politics'],
      resolution: '1920x1080',
      fps: 30,
    });
  });
});

describe('formatUploadDate', () => {
  it('formats YYYYMMDD values into a readable date', () => {
    expect(formatUploadDate('20260307')).toBe('2026-03-07');
  });

  it('returns invalid values unchanged', () => {
    expect(formatUploadDate('2026/03/07')).toBe('2026/03/07');
  });
});

describe('formatUploadDateTooltip', () => {
  it('formats upload dates as Chinese year-month-day without zero padding', () => {
    expect(formatUploadDateTooltip('20260307')).toBe('2026年3月7日');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatUploadDateTooltip('not-a-date')).toBe('');
  });
});

describe('formatRelativeUploadTime', () => {
  it('formats recent uploads as minutes ago', () => {
    expect(formatRelativeUploadTime('2026-03-19T11:45:00Z', { now: '2026-03-19T12:00:00Z' })).toBe('15 分鐘前');
  });

  it('formats same-day uploads as hours ago', () => {
    expect(formatRelativeUploadTime('2026-03-19T02:00:00Z', { now: '2026-03-19T12:00:00Z' })).toBe('10 小時前');
  });

  it('formats date-only uploads as days ago', () => {
    expect(formatRelativeUploadTime('20260307', { now: new Date(2026, 2, 19, 0, 0, 0) })).toBe('12 天前');
  });

  it('formats older uploads as months or years ago', () => {
    expect(formatRelativeUploadTime('20251201', { now: new Date(2026, 2, 19, 0, 0, 0) })).toBe('3 個月前');
    expect(formatRelativeUploadTime('20230301', { now: new Date(2026, 2, 19, 0, 0, 0) })).toBe('3 年前');
  });
});

describe('fetchVideoInfo', () => {
  it('fetches info.json from the current asset directory', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: createHeaders({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        title: 'Loaded',
        uploader: 'Uploader',
        duration_string: '10:16',
      }),
    });

    await expect(fetchVideoInfo('https://example.com/ipfs/bafy123', { fetchImpl })).resolves.toEqual({
      id: '',
      title: 'Loaded',
      uploader: 'Uploader',
      channelId: '',
      uploadDate: '',
      durationString: '10:16',
      description: '',
      tags: [],
      categories: [],
      resolution: '',
      fps: null,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/ipfs/bafy123/info.json',
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
      })
    );
  });

  it('rejects HTML fallback responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: createHeaders({ 'content-type': 'text/html; charset=utf-8' }),
      json: vi.fn(),
    });

    await expect(fetchVideoInfo('https://example.com/ipfs/bafy123/', { fetchImpl })).rejects.toThrow(
      'metadata request returned HTML'
    );
  });
});
