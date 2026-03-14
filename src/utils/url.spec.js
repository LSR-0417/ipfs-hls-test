import { describe, it, expect } from 'vitest';
import { parsePlayerParams } from './url';

describe('parsePlayerParams', () => {
  it('parses cid and time', () => {
    const result = parsePlayerParams('?cid=bafy123&gateway=https://example.com/ipfs/&t=120');
    expect(result).toEqual({
      cid: 'bafy123',
      time: 120,
    });
  });

  it('trims inputs and normalizes invalid time to 0', () => {
    const result = parsePlayerParams('?cid=%20QmAbc%20&gateway=%20https://g.example/ipfs/%20&t=abc');
    expect(result).toEqual({
      cid: 'QmAbc',
      time: 0,
    });
  });

  it('handles missing params', () => {
    const result = parsePlayerParams('');
    expect(result).toEqual({
      cid: '',
      time: 0,
    });
  });
});
