import { gatewayProbeSmoothPlaybackRateThreshold } from './gateway';

export function formatGatewayPlaybackText(probeState) {
  const state = probeState?.state || 'idle';
  const playbackRate = Number.isFinite(probeState?.playbackRate) ? probeState.playbackRate : null;
  const sampleSegmentCount = Number.isFinite(probeState?.sampleSegmentCount) ? probeState.sampleSegmentCount : 0;
  const completedSampleCount = Number.isFinite(probeState?.completedSampleCount) ? probeState.completedSampleCount : 0;

  if (state === 'ready') {
    if (playbackRate != null && playbackRate >= gatewayProbeSmoothPlaybackRateThreshold) {
      return `順播穩定 · ${formatPlaybackRate(playbackRate)}`;
    }

    if (playbackRate != null) {
      return `可順播 · ${formatPlaybackRate(playbackRate)}`;
    }

    return '可順播';
  }

  if (state === 'playlist_ready') {
    if (playbackRate != null) {
      return `能播，但偏慢 · ${formatPlaybackRate(playbackRate)}`;
    }

    return '已連上，正在確認順播';
  }

  if (state === 'probing') {
    if (sampleSegmentCount > 0) {
      return `正在測速 ${completedSampleCount}/${sampleSegmentCount}`;
    }

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

function formatPlaybackRate(value) {
  return `${value.toFixed(1)}x`;
}
