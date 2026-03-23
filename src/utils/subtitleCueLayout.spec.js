import { describe, expect, it } from 'vitest';
import { resolveSecondaryCueOffset } from './subtitleCueLayout';

describe('resolveSecondaryCueOffset', () => {
  it('returns 0 when either subtitle block is missing', () => {
    expect(resolveSecondaryCueOffset([], [{ top: 10, bottom: 20 }])).toBe(0);
    expect(resolveSecondaryCueOffset([{ top: 30, bottom: 40 }], [])).toBe(0);
  });

  it('aligns the secondary block to the top of the primary block', () => {
    expect(
      resolveSecondaryCueOffset(
        [{ top: 120, bottom: 154 }],
        [{ top: 70, bottom: 110 }]
      )
    ).toBe(10);
  });

  it('uses the outer block bounds instead of matching individual cue rows', () => {
    expect(
      resolveSecondaryCueOffset(
        [
          { top: 200, bottom: 230 },
          { top: 232, bottom: 260 },
        ],
        [
          { top: 120, bottom: 145 },
          { top: 148, bottom: 188 },
        ]
      )
    ).toBe(12);
  });

  it('clamps negative overlap gaps to 0', () => {
    expect(
      resolveSecondaryCueOffset(
        [{ top: 110, bottom: 145 }],
        [{ top: 90, bottom: 130 }]
      )
    ).toBe(0);
  });
});
