import { describe, expect, it } from 'vitest';
import { buildShareUrl, formatShareStartTime } from './share';

describe('buildShareUrl', () => {
  it('builds a canonical share link with cid and time', () => {
    expect(buildShareUrl('https://example.com/ipfs-hls-test/?gateway=https://ipfs.io/ipfs/&cid=old&t=10', ' bafy123 ', 93)).toBe(
      'https://example.com/ipfs-hls-test/?cid=bafy123&t=93'
    );
  });

  it('omits the time parameter when the playback time is not positive', () => {
    expect(buildShareUrl('https://example.com/watch?cid=old&t=10', 'bafy123', 0)).toBe(
      'https://example.com/watch?cid=bafy123'
    );
    expect(buildShareUrl('https://example.com/watch?cid=old&t=10', 'bafy123', -5)).toBe(
      'https://example.com/watch?cid=bafy123'
    );
  });

  it('returns an empty string when cid is missing', () => {
    expect(buildShareUrl('https://example.com/watch', '', 25)).toBe('');
  });
});

describe('formatShareStartTime', () => {
  it('formats sub-hour times like YouTube start times', () => {
    expect(formatShareStartTime(0)).toBe('0:00');
    expect(formatShareStartTime(5)).toBe('0:05');
    expect(formatShareStartTime(65)).toBe('1:05');
    expect(formatShareStartTime(3599)).toBe('59:59');
  });

  it('formats hour-long times without padding the first segment', () => {
    expect(formatShareStartTime(3600)).toBe('1:00:00');
    expect(formatShareStartTime(3661)).toBe('1:01:01');
    expect(formatShareStartTime(36000)).toBe('10:00:00');
  });
});
