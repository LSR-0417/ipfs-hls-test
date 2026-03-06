import { describe, it, expect } from 'vitest';
import { formatTime } from './time';

describe('formatTime', () => {
  it('should format seconds to mm:ss when hours are zero', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(59)).toBe('00:59');
    expect(formatTime(60)).toBe('01:00');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('should format correctly when there are hours', () => {
    expect(formatTime(3600)).toBe('01:00:00');
    expect(formatTime(3661)).toBe('01:01:01');
    expect(formatTime(36000)).toBe('10:00:00');
    expect(formatTime(359999)).toBe('99:59:59');
  });

  it('should handle floating point numbers properly', () => {
    expect(formatTime(60.4)).toBe('01:00');
    expect(formatTime(60.9)).toBe('01:00');
    expect(formatTime(3600.5)).toBe('01:00:00');
  });
});
