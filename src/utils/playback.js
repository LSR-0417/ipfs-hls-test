function getVideoJsPlayer(win) {
  try {
    const vjs = win?.videojs;
    if (vjs && typeof vjs.getAllPlayers === 'function') {
      const players = vjs.getAllPlayers() || [];
      return players[0] || null;
    }
  } catch (_) {
    // ignore
  }

  return null;
}

function getHtmlVideo(win) {
  try {
    const doc = win?.document;
    if (doc && typeof doc.querySelector === 'function') {
      return doc.querySelector('video');
    }
  } catch (_) {
    // ignore
  }

  return null;
}

export function getCurrentPlaybackTime(win) {
  if (!win) return 0;

  try {
    const player = getVideoJsPlayer(win);
    if (player && typeof player.currentTime === 'function') {
      const t = player.currentTime();
      return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
    }
  } catch (_) {
    // ignore
  }

  try {
    const video = getHtmlVideo(win);
    const t = video?.currentTime;
    return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
  } catch (_) {
    // ignore
  }

  return 0;
}

export function getPlaybackSnapshot(win) {
  if (!win) {
    return { time: 0, isPlaying: false };
  }

  try {
    const player = getVideoJsPlayer(win);
    if (player) {
      const t = typeof player.currentTime === 'function' ? player.currentTime() : 0;
      const paused = typeof player.paused === 'function' ? player.paused() : true;
      return {
        time: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0,
        isPlaying: paused === false,
      };
    }
  } catch (_) {
    // ignore
  }

  try {
    const video = getHtmlVideo(win);
    if (video) {
      const t = video.currentTime;
      return {
        time: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0,
        isPlaying: video.paused === false && video.ended !== true,
      };
    }
  } catch (_) {
    // ignore
  }

  return { time: 0, isPlaying: false };
}
