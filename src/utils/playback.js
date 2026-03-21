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

function createEmptyPlaybackSnapshot() {
  return {
    time: 0,
    duration: 0,
    isPlaying: false,
    hasEnded: false,
  };
}

function normalizePlaybackTime(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizePlaybackDuration(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function resolvePlaybackSnapshot(getters) {
  try {
    const time = normalizePlaybackTime(getters.getTime());
    const duration = normalizePlaybackDuration(getters.getDuration());
    const hasEnded = getters.getEnded() === true || (duration > 0 && time >= duration);
    const isPlaying = getters.getPaused() === false && hasEnded !== true;

    return {
      time: hasEnded && duration > 0 ? duration : time,
      duration,
      isPlaying,
      hasEnded,
    };
  } catch (_) {
    return createEmptyPlaybackSnapshot();
  }
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
  return getPlaybackSnapshot(win).time;
}

export function getPlayerPlaybackSnapshot(player) {
  if (!player) {
    return createEmptyPlaybackSnapshot();
  }

  return resolvePlaybackSnapshot({
    getTime: () => (typeof player.currentTime === 'function' ? player.currentTime() : player.currentTime),
    getDuration: () => (typeof player.duration === 'function' ? player.duration() : player.duration),
    getPaused: () => (typeof player.paused === 'function' ? player.paused() : player.paused),
    getEnded: () => (typeof player.ended === 'function' ? player.ended() : player.ended),
  });
}

export function getPlaybackSnapshot(win) {
  if (!win) {
    return createEmptyPlaybackSnapshot();
  }

  try {
    const player = getVideoJsPlayer(win);
    if (player) {
      return getPlayerPlaybackSnapshot(player);
    }
  } catch (_) {
    // ignore
  }

  try {
    const video = getHtmlVideo(win);
    if (video) {
      return resolvePlaybackSnapshot({
        getTime: () => video.currentTime,
        getDuration: () => video.duration,
        getPaused: () => video.paused,
        getEnded: () => video.ended,
      });
    }
  } catch (_) {
    // ignore
  }

  return createEmptyPlaybackSnapshot();
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
