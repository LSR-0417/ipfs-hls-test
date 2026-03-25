import { describe, expect, it, vi } from 'vitest';
import {
  buildInfoJsonPayload,
  createVideoInfoDraftFormSnapshot,
  createVideoInfoDraftFormState,
  createDefaultVideoInfo,
  extractDescriptionHashtags,
  fetchVideoInfo,
  formatRelativeUploadTime,
  formatUploadDate,
  formatUploadDateTooltip,
  isVideoInfoDraftFormPristine,
  linkifyDescription,
  normalizeVideoInfo,
  stringifyInfoJson,
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

describe('createVideoInfoDraftFormState', () => {
  it('prefills the dialog form from the currently loaded video metadata', () => {
    expect(
      createVideoInfoDraftFormState({
        id: 'demo-id',
        title: 'Demo Title',
        uploader: 'AstraStream',
        channelId: 'channel-id',
        uploadDate: '20260325',
        description: 'desc',
        tags: ['IPFS', 'Web3'],
      })
    ).toEqual({
      id: 'demo-id',
      title: 'Demo Title',
      uploader: 'AstraStream',
      channelId: 'channel-id',
      uploadDate: '2026-03-25',
      description: 'desc',
      tags: 'IPFS, Web3',
    });
  });
});

describe('isVideoInfoDraftFormPristine', () => {
  it('returns true when the current form still matches the last synced snapshot', () => {
    const formState = createVideoInfoDraftFormState({
      title: 'Demo Title',
      uploader: 'AstraStream',
      uploadDate: '20260325',
    });
    const snapshot = createVideoInfoDraftFormSnapshot(formState);

    expect(isVideoInfoDraftFormPristine(formState, snapshot)).toBe(true);
  });

  it('returns false after the user changes the form or when no synced snapshot exists', () => {
    const formState = createVideoInfoDraftFormState({
      title: 'Demo Title',
      uploader: 'AstraStream',
      uploadDate: '20260325',
    });
    const snapshot = createVideoInfoDraftFormSnapshot(formState);

    expect(
      isVideoInfoDraftFormPristine(
        {
          ...formState,
          title: 'Edited Title',
        },
        snapshot
      )
    ).toBe(false);
    expect(isVideoInfoDraftFormPristine(formState, null)).toBe(false);
  });
});

describe('buildInfoJsonPayload', () => {
  it('maps frontend metadata fields back into the packaged info.json shape', () => {
    expect(
      buildInfoJsonPayload({
        id: ' UdGk5Qv0C1M ',
        title: ' Demo Title ',
        uploader: ' AstraStream ',
        channelId: ' UCYgpfeq5JyEo_pPmu-4VLiA ',
        uploadDate: '2026-03-07',
        durationString: '10:16',
        description: 'desc',
        tags: [' IPFS ', '', 'Web3'],
        categories: ['Technology'],
        resolution: '1920x1080',
        fps: '30',
      })
    ).toEqual({
      id: 'UdGk5Qv0C1M',
      title: 'Demo Title',
      uploader: 'AstraStream',
      channel_id: 'UCYgpfeq5JyEo_pPmu-4VLiA',
      upload_date: '20260307',
      duration_string: '10:16',
      description: 'desc',
      tags: ['IPFS', 'Web3'],
      categories: ['Technology'],
      resolution: '1920x1080',
      fps: 30,
    });
  });

  it('omits empty values from the generated info.json payload', () => {
    expect(
      buildInfoJsonPayload({
        title: 'Only Title',
        uploader: '',
        tags: [],
        fps: '',
      })
    ).toEqual({
      title: 'Only Title',
    });
  });
});

describe('stringifyInfoJson', () => {
  it('formats the generated info.json with indentation and a trailing newline', () => {
    expect(
      stringifyInfoJson({
        title: 'Demo Title',
        uploadDate: '20260307',
      })
    ).toBe('{\n  "title": "Demo Title",\n  "upload_date": "20260307"\n}\n');
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

describe('linkifyDescription', () => {
  it('splits plain text and clickable http links while preserving surrounding text', () => {
    expect(linkifyDescription('Visit https://example.com/watch?v=1 now')).toEqual([
      { type: 'text', text: 'Visit ' },
      {
        type: 'link',
        text: 'https://example.com/watch?v=1',
        href: 'https://example.com/watch?v=1',
      },
      { type: 'text', text: ' now' },
    ]);
  });

  it('normalizes www links and excludes trailing punctuation from the link target', () => {
    expect(linkifyDescription('Docs: www.example.com/path?q=1, thanks.')).toEqual([
      { type: 'text', text: 'Docs: ' },
      {
        type: 'link',
        text: 'www.example.com/path?q=1',
        href: 'https://www.example.com/path?q=1',
      },
      { type: 'text', text: ', thanks.' },
    ]);
  });

  it('keeps line breaks as text so description formatting is preserved', () => {
    expect(linkifyDescription('line one\nhttps://example.com\nline three')).toEqual([
      { type: 'text', text: 'line one\n' },
      {
        type: 'link',
        text: 'https://example.com',
        href: 'https://example.com',
      },
      { type: 'text', text: '\nline three' },
    ]);
  });
});

describe('extractDescriptionHashtags', () => {
  it('returns the first three unique hashtags from the description text', () => {
    expect(
      extractDescriptionHashtags('hello #IPFS world\n#Web3 and #Taiwan and #Extra and #IPFS again')
    ).toEqual(['IPFS', 'Web3', 'Taiwan']);
  });

  it('supports chinese hashtags and ignores url fragments', () => {
    expect(
      extractDescriptionHashtags('看這裡 #台灣 #去中心化 https://example.com/page#section #測試')
    ).toEqual(['台灣', '去中心化', '測試']);
  });

  it('returns fewer items when fewer hashtags are present', () => {
    expect(extractDescriptionHashtags('plain text #OnlyOne', { limit: 3 })).toEqual(['OnlyOne']);
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
