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

const defaultPlaybackHotkeyOptions = Object.freeze({
  seekStepSeconds: 5,
  longSeekStepSeconds: 10,
  frameRate: Number.NaN,
  frameStepFallbackFrameRate: 30,
  onToggleHelp: null,
  onToggleFullscreen: null,
  onToggleSubtitles: null,
});

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

function normalizePlaybackHotkeyOptions(optionsOrSeekStepSeconds) {
  if (Number.isFinite(optionsOrSeekStepSeconds)) {
    return {
      ...defaultPlaybackHotkeyOptions,
      seekStepSeconds: Number(optionsOrSeekStepSeconds),
    };
  }

  if (!optionsOrSeekStepSeconds || typeof optionsOrSeekStepSeconds !== 'object') {
    return { ...defaultPlaybackHotkeyOptions };
  }

  return {
    ...defaultPlaybackHotkeyOptions,
    ...optionsOrSeekStepSeconds,
  };
}

function getNormalizedKey(event) {
  const key = typeof event?.key === 'string' ? event.key : '';
  return key.length === 1 ? key.toLowerCase() : key;
}

function isSpacePlaybackKey(event) {
  return event?.key === ' ' || event?.key === 'Spacebar' || event?.code === 'Space';
}

function isHelpPlaybackKey(event) {
  return event?.key === '?' || (event?.code === 'Slash' && event?.shiftKey === true);
}

function isFrameStepBackwardKey(event) {
  return event?.shiftKey !== true && (event?.code === 'Comma' || event?.key === ',');
}

function isFrameStepForwardKey(event) {
  return event?.shiftKey !== true && (event?.code === 'Period' || event?.key === '.');
}

function isPlayerPaused(player) {
  return typeof player?.paused === 'function' ? player.paused() === true : false;
}

function preventDefault(event) {
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
}

function getFrameStepSeconds(frameRate, fallbackFrameRate = 30) {
  const fps = Number(frameRate);
  if (Number.isFinite(fps) && fps > 0) {
    return 1 / fps;
  }

  const fallbackFps = Number(fallbackFrameRate);
  if (Number.isFinite(fallbackFps) && fallbackFps > 0) {
    return 1 / fallbackFps;
  }

  return 1 / 30;
}

function togglePlayerPlayback(event, player) {
  if (typeof player?.paused !== 'function') {
    return false;
  }

  const shouldPlay = player.paused() === true;
  if (shouldPlay && typeof player.play !== 'function') {
    return false;
  }
  if (!shouldPlay && typeof player.pause !== 'function') {
    return false;
  }

  preventDefault(event);

  if (shouldPlay) {
    void player.play();
  } else {
    player.pause();
  }

  return true;
}

function applySeek(event, player, deltaSeconds) {
  const currentTime = typeof player?.currentTime === 'function' ? player.currentTime() : Number.NaN;
  const duration = typeof player?.duration === 'function' ? player.duration() : Number.NaN;
  const nextTime = clampSeekTime(currentTime, duration, deltaSeconds);

  if (nextTime === null || typeof player?.currentTime !== 'function') {
    return false;
  }

  preventDefault(event);
  player.currentTime(nextTime);
  return true;
}

function togglePlayerMute(event, player) {
  if (typeof player?.muted !== 'function') {
    return false;
  }

  preventDefault(event);
  player.muted(player.muted() !== true);
  return true;
}

function togglePlayerFullscreen(event, player) {
  const isFullscreen = typeof player?.isFullscreen === 'function' ? player.isFullscreen() === true : false;

  if (isFullscreen) {
    if (typeof player?.exitFullscreen !== 'function') {
      return false;
    }

    preventDefault(event);
    player.exitFullscreen();
    return true;
  }

  if (typeof player?.requestFullscreen !== 'function') {
    return false;
  }

  preventDefault(event);
  player.requestFullscreen();
  return true;
}

function applyFrameStep(event, player, deltaFrames, frameRate, fallbackFrameRate) {
  if (!isPlayerPaused(player)) {
    return false;
  }

  const secondsPerFrame = getFrameStepSeconds(frameRate, fallbackFrameRate);
  return applySeek(event, player, deltaFrames * secondsPerFrame);
}

function runPlaybackHotkeyCallback(event, callback) {
  if (typeof callback !== 'function') {
    return false;
  }

  const result = callback();
  if (result === false) {
    return false;
  }

  preventDefault(event);
  return true;
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

export function getPlaybackHotkeyAction(event, optionsOrSeekStepSeconds = 5) {
  if (shouldIgnorePlaybackHotkey(event)) {
    return null;
  }

  const options = normalizePlaybackHotkeyOptions(optionsOrSeekStepSeconds);
  const normalizedKey = getNormalizedKey(event);

  if (event?.key === 'ArrowLeft') {
    return { type: 'seek', deltaSeconds: -options.seekStepSeconds };
  }

  if (event?.key === 'ArrowRight') {
    return { type: 'seek', deltaSeconds: options.seekStepSeconds };
  }

  if (normalizedKey === 'j') {
    return { type: 'seek', deltaSeconds: -options.longSeekStepSeconds };
  }

  if (normalizedKey === 'l') {
    return { type: 'seek', deltaSeconds: options.longSeekStepSeconds };
  }

  if (isSpacePlaybackKey(event) || normalizedKey === 'k') {
    return { type: 'toggle-playback' };
  }

  if (normalizedKey === 'm') {
    return { type: 'toggle-mute' };
  }

  if (normalizedKey === 'f') {
    return { type: 'toggle-fullscreen' };
  }

  if (normalizedKey === 'c') {
    return { type: 'toggle-subtitles' };
  }

  if (isFrameStepBackwardKey(event)) {
    return { type: 'frame-step', deltaFrames: -1 };
  }

  if (isFrameStepForwardKey(event)) {
    return { type: 'frame-step', deltaFrames: 1 };
  }

  if (isHelpPlaybackKey(event)) {
    return { type: 'toggle-help' };
  }

  return null;
}

export function applyPlaybackHotkey(event, player, optionsOrSeekStepSeconds = 5) {
  const options = normalizePlaybackHotkeyOptions(optionsOrSeekStepSeconds);
  const action = getPlaybackHotkeyAction(event, options);
  if (!action) {
    return false;
  }

  if (action.type === 'toggle-help') {
    return runPlaybackHotkeyCallback(event, options.onToggleHelp);
  }

  if (action.type === 'toggle-subtitles') {
    return runPlaybackHotkeyCallback(event, options.onToggleSubtitles);
  }

  if (!player) {
    return false;
  }

  if (action.type === 'toggle-playback') {
    return togglePlayerPlayback(event, player);
  }

  if (action.type === 'toggle-mute') {
    return togglePlayerMute(event, player);
  }

  if (action.type === 'toggle-fullscreen') {
    if (typeof options.onToggleFullscreen === 'function') {
      return runPlaybackHotkeyCallback(event, options.onToggleFullscreen);
    }

    return togglePlayerFullscreen(event, player);
  }

  if (action.type === 'frame-step') {
    return applyFrameStep(
      event,
      player,
      action.deltaFrames,
      options.frameRate,
      options.frameStepFallbackFrameRate
    );
  }

  return applySeek(event, player, action.deltaSeconds);
}
