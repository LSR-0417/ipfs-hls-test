export const smoothPlaybackThresholdMs = 800;

export function formatGatewayPlaybackText(probeState) {
  const state = probeState?.state || 'idle';
  const durationMs = Number.isFinite(probeState?.durationMs) ? probeState.durationMs : null;

  if (state === 'ready') {
    if (durationMs != null && durationMs <= smoothPlaybackThresholdMs) {
      return '順播穩定';
    }

    return '可順播';
  }

  if (state === 'playlist_ready') {
    const detail = String(probeState?.detail || '');
    if (detail.includes('偏慢')) {
      return '能播，但偏慢';
    }

    return '已連上，正在確認順播';
  }

  if (state === 'probing') {
    return '正在判斷順播度';
  }

  if (state === 'degraded') {
    return '可連上，但容易卡頓';
  }

  if (state === 'rate_limited') {
    return '暫時無法判斷';
  }

  if (state === 'redirected') {
    return '路徑不穩，結果未定';
  }

  if (state === 'failed') {
    return '大概率無法順播';
  }

  return String(probeState?.detail || '等待檢查');
}
