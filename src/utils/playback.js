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

const INTERACTIVE_HOTKEY_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="menuitem"]',
  '[role="textbox"]',
].join(', ');

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

export function clampSeekTime(currentTime, duration, deltaSeconds) {
  if (!Number.isFinite(currentTime)) {
    return null;
  }

  const nextTime = Math.max(0, currentTime + deltaSeconds);
  if (Number.isFinite(duration) && duration >= 0) {
    return Math.min(nextTime, duration);
  }

  return nextTime;
}

export function shouldIgnorePlaybackHotkey(event) {
  if (!event || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return true;
  }

  const target = event.target;
  if (!target || typeof target !== 'object') {
    return false;
  }

  if (target.isContentEditable === true) {
    return true;
  }

  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button') {
    return true;
  }

  if (typeof target.closest === 'function' && target.closest(INTERACTIVE_HOTKEY_TARGET_SELECTOR)) {
    return true;
  }

  return false;
}

function isSpacePlaybackKey(event) {
  return event?.key === ' ' || event?.key === 'Spacebar' || event?.code === 'Space';
}

export function getPlaybackHotkeyAction(event, seekStepSeconds = 5) {
  if (shouldIgnorePlaybackHotkey(event)) {
    return null;
  }

  if (event.key === 'ArrowLeft') {
    return { type: 'seek', deltaSeconds: -seekStepSeconds };
  }

  if (event.key === 'ArrowRight') {
    return { type: 'seek', deltaSeconds: seekStepSeconds };
  }

  if (isSpacePlaybackKey(event)) {
    return { type: 'toggle-playback' };
  }

  return null;
}

export function applyPlaybackHotkey(event, player, seekStepSeconds = 5) {
  const action = getPlaybackHotkeyAction(event, seekStepSeconds);
  if (!action || !player) {
    return false;
  }

  if (action.type === 'toggle-playback') {
    if (typeof player.paused !== 'function') {
      return false;
    }

    const shouldPlay = player.paused() === true;
    if (shouldPlay && typeof player.play !== 'function') {
      return false;
    }
    if (!shouldPlay && typeof player.pause !== 'function') {
      return false;
    }

    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (shouldPlay) {
      void player.play();
    } else {
      player.pause();
    }

    return true;
  }

  const currentTime = typeof player.currentTime === 'function' ? player.currentTime() : Number.NaN;
  const duration = typeof player.duration === 'function' ? player.duration() : Number.NaN;
  const nextTime = clampSeekTime(currentTime, duration, action.deltaSeconds);

  if (nextTime === null || typeof player.currentTime !== 'function') {
    return false;
  }

  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  player.currentTime(nextTime);
  return true;
}
