import { describe, expect, it } from 'vitest';
import { formatGatewayPlaybackText } from './gatewayStatus';

describe('formatGatewayPlaybackText', () => {
  it('marks fast ready gateways as smooth playback', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'ready',
        durationMs: 420,
      })
    ).toBe('順播穩定');
  });

  it('marks slower ready gateways as playable', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'ready',
        durationMs: 1600,
      })
    ).toBe('可順播');
  });

  it('describes playlist-ready slow gateways as playable but slow', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'playlist_ready',
        detail: '已找到 index.m3u8，前 3 個片段可取但偏慢',
      })
    ).toBe('能播，但偏慢');
  });

  it('describes playlist-ready in-progress gateways as still being checked', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'playlist_ready',
        detail: '已找到 index.m3u8，正在驗證片段',
      })
    ).toBe('已連上，正在確認順播');
  });

  it('describes degraded gateways as likely to stutter', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'degraded',
        detail: '已找到 index.m3u8，但前幾個片段不可用 (HTTP 404)',
      })
    ).toBe('可連上，但容易卡頓');
  });

  it('describes failed gateways as unlikely to play smoothly', () => {
    expect(
      formatGatewayPlaybackText({
        state: 'failed',
        detail: '找不到 index.m3u8 (HTTP 404)',
      })
    ).toBe('大概率無法順播');
  });
});
