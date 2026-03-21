<template>
  <div class="video-player-shell">
    <div data-vjs-player>
      <video
        ref="videoRef"
        class="video-js vjs-big-play-centered"
        crossorigin="anonymous"
        :poster="posterUrl"
        playsinline
        webkit-playsinline
      ></video>
    </div>

    <div
      v-if="showStartupGate"
      class="startup-gate"
      data-testid="video-player-startup-gate"
      role="status"
      aria-live="polite"
    >
      <div class="startup-gate-copy">
        <p class="startup-gate-title">{{ startupGateTitle }}</p>
        <p class="startup-gate-detail">{{ startupGateDetail }}</p>
      </div>
      <button
        v-if="startupGateCanBypass"
        type="button"
        class="startup-gate-action"
        @click="overrideStartupGate"
      >
        立即播放
      </button>
    </div>

    <div
      v-if="isHotkeyHelpOpen"
      class="hotkey-help-backdrop"
      data-testid="video-player-hotkey-help-backdrop"
      @click.self="closeHotkeyHelp"
    >
      <div
        ref="hotkeyHelpDialogRef"
        class="hotkey-help-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="videoPlayerHotkeyHelpTitle"
        tabindex="-1"
        data-testid="video-player-hotkey-help-dialog"
      >
        <div class="hotkey-help-header">
          <div class="hotkey-help-copy">
            <p class="hotkey-help-kicker">Keyboard Shortcuts</p>
            <h2 id="videoPlayerHotkeyHelpTitle">播放器快捷鍵</h2>
            <p class="hotkey-help-summary">精簡鍵位表。焦點在輸入框或按鈕上時不會攔截按鍵。</p>
          </div>
          <button class="hotkey-help-close" type="button" @click="closeHotkeyHelp" aria-label="關閉快捷鍵說明">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="hotkey-help-body">
          <section v-for="section in hotkeyHelpSections" :key="section.id" class="hotkey-help-section">
            <div class="hotkey-help-section-header">
              <p class="hotkey-help-section-title">{{ section.title }}</p>
            </div>

            <ul class="hotkey-help-list">
              <li v-for="item in section.items" :key="item.id" class="hotkey-help-row">
                <div class="hotkey-help-keys" :aria-label="`${item.label} 快捷鍵`">
                  <kbd v-for="key in item.keys" :key="key" class="hotkey-chip">{{ key }}</kbd>
                </div>
                <strong class="hotkey-help-label">{{ item.label }}</strong>
                <span class="hotkey-help-detail">{{ item.detail }}</span>
              </li>
            </ul>
          </section>
        </div>

        <p class="hotkey-help-hint">
          按 <kbd class="hotkey-chip hotkey-chip--inline">?</kbd> 或
          <kbd class="hotkey-chip hotkey-chip--inline">Esc</kbd> 關閉
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import {
  gatewayProbePlaybackRateThreshold,
  gatewayProbeSegmentSampleCount,
  probeGatewayAvailability,
} from '../utils/gateway';
import { formatTime } from '../utils/time';
import { applyPlaybackHotkey, getPlayerPlaybackSnapshot } from '../utils/playback';
import {
  persistSubtitlePreference,
  readStoredSubtitlePreference,
  reconcileSubtitlePreference,
  resolveToggledSubtitlePreference,
} from '../utils/subtitles';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
if (typeof window !== 'undefined') {
  window.videojs = videojs;
}

const props = defineProps({
  cid: {
    type: String,
    default: '',
  },
  gateway: {
    type: String,
    default: '',
  },
  m3u8Url: {
    type: String,
    required: false,
    default: '',
  },
  posterUrl: {
    type: String,
    required: false,
    default: '',
  },
  subtitles: {
    type: Array,
    default: () => [],
  },
  frameRate: {
    type: Number,
    default: Number.NaN,
  },
  startTime: {
    type: Number,
    default: 0,
  },
  shouldAutoplay: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['status-update', 'levels-loaded', 'playback-snapshot']);

const SEEK_STEP_SECONDS = 5;
const LONG_SEEK_STEP_SECONDS = 10;
const PROGRESS_EMIT_STEP_SECONDS = 5;
const STARTUP_BUFFER_THRESHOLD_SECONDS = 10;

const hotkeyHelpSections = Object.freeze([
  {
    id: 'transport',
    title: '播放控制',
    items: [
      {
        id: 'playback',
        keys: ['Space', 'K'],
        label: '播放 / 暫停',
        detail: '切換播放',
      },
      {
        id: 'seek-short',
        keys: ['←', '→'],
        label: '5 秒微調',
        detail: '左右 5 秒',
      },
      {
        id: 'seek-long',
        keys: ['J', 'L'],
        label: '10 秒跳轉',
        detail: '前後 10 秒',
      },
    ],
  },
  {
    id: 'view',
    title: '觀看狀態',
    items: [
      {
        id: 'mute',
        keys: ['M'],
        label: '靜音',
        detail: '切換聲音',
      },
      {
        id: 'fullscreen',
        keys: ['F'],
        label: '全螢幕',
        detail: '切換畫面',
      },
      {
        id: 'subtitles',
        keys: ['C'],
        label: '字幕',
        detail: '切回上次語言',
      },
    ],
  },
  {
    id: 'precision',
    title: '精準操作',
    items: [
      {
        id: 'frame-step',
        keys: [',', '.'],
        label: '逐幀播放',
        detail: '暫停時前後一格',
      },
      {
        id: 'help',
        keys: ['?'],
        label: '快捷鍵說明',
        detail: '顯示 / 關閉',
      },
    ],
  },
]);

const hotkeyHelpDialogRef = ref(null);
const isHotkeyHelpOpen = ref(false);
const videoRef = ref(null);
let player = null;
let sourceSeq = 0;
let isApplyingSubtitlePreference = false;
let textTrackList = null;
let lastFocusedElement = null;
let isSwitchingSource = false;
let lastProgressSnapshotTime = -1;
let startupGateSourceSeq = 0;
let startupGateReady = false;
let startupGateWaitingForBuffer = false;
let startupGateBypassed = false;
let startupGateMeasuredPlaybackRate = null;
const showStartupGate = ref(false);
const startupGateTitle = ref('');
const startupGateDetail = ref('');
const startupGateCanBypass = ref(false);

function isHelpHotkeyEvent(event) {
  return event?.key === '?' || (event?.code === 'Slash' && event?.shiftKey === true);
}

function isEscapeKey(event) {
  return event?.key === 'Escape' || event?.key === 'Esc' || event?.code === 'Escape';
}

function resolveSubtitlePreference(subtitles) {
  const target = typeof window !== 'undefined' ? window : null;
  const storedPreference = readStoredSubtitlePreference(target);
  const nextPreference = reconcileSubtitlePreference(storedPreference, subtitles, target?.navigator);

  if (storedPreference.mode !== nextPreference.mode || storedPreference.lang !== nextPreference.lang) {
    persistSubtitlePreference(nextPreference, target);
  }

  return nextPreference;
}

function getSubtitleTracks() {
  return player && typeof player.remoteTextTracks === 'function' ? player.remoteTextTracks() : null;
}

function getSubtitleTrackLanguage(track) {
  return track?.language || track?.srclang || '';
}

function getActiveSubtitleLanguage() {
  const tracks = getSubtitleTracks();
  if (!tracks) return '';

  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track.mode === 'showing') {
      return getSubtitleTrackLanguage(track);
    }
  }

  return '';
}

function setActiveSubtitleLanguage(activeLang = '') {
  const tracks = getSubtitleTracks();
  if (!tracks || tracks.length === 0) return false;

  let matched = activeLang === '';
  isApplyingSubtitlePreference = true;

  try {
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      const shouldShow = Boolean(activeLang) && getSubtitleTrackLanguage(track) === activeLang;
      if (shouldShow) {
        matched = true;
      }
      track.mode = shouldShow ? 'showing' : 'disabled';
    }
  } finally {
    isApplyingSubtitlePreference = false;
  }

  return matched;
}

function subtitleLabelForLanguage(lang) {
  const matchedSubtitle = Array.isArray(props.subtitles)
    ? props.subtitles.find((subtitle) => subtitle.lang === lang)
    : null;

  return matchedSubtitle?.label || lang || '字幕';
}

function toggleSubtitleVisibility() {
  if (!player || !Array.isArray(props.subtitles) || props.subtitles.length === 0) {
    return false;
  }

  bindSubtitleTrackChangeListener();

  const target = typeof window !== 'undefined' ? window : null;
  const nextPreference = resolveToggledSubtitlePreference(
    readStoredSubtitlePreference(target),
    props.subtitles,
    target?.navigator,
    getActiveSubtitleLanguage()
  );
  const nextLang = nextPreference.mode === 'showing' ? nextPreference.lang : '';

  if (!setActiveSubtitleLanguage(nextLang)) {
    return false;
  }

  persistSubtitlePreference(nextPreference, target);

  emit(
    'status-update',
    nextPreference.mode === 'showing' ? `字幕已開啟：${subtitleLabelForLanguage(nextLang)}` : '字幕已關閉'
  );

  return true;
}

function openHotkeyHelp() {
  if (isHotkeyHelpOpen.value) return;

  lastFocusedElement = typeof document !== 'undefined' ? document.activeElement : null;
  isHotkeyHelpOpen.value = true;
  void nextTick(() => {
    hotkeyHelpDialogRef.value?.focus?.();
  });
}

function closeHotkeyHelp() {
  const nextFocusTarget = lastFocusedElement;
  lastFocusedElement = null;
  isHotkeyHelpOpen.value = false;
  void nextTick(() => {
    nextFocusTarget?.focus?.();
  });
}

function toggleHotkeyHelp() {
  if (isHotkeyHelpOpen.value) {
    closeHotkeyHelp();
    return true;
  }

  openHotkeyHelp();
  return true;
}

function shouldRunStartupWarmup() {
  return Boolean(props.cid && props.gateway && props.m3u8Url && !(props.startTime > 0));
}

function resetStartupGate(seq = sourceSeq) {
  startupGateSourceSeq = seq;
  startupGateReady = false;
  startupGateWaitingForBuffer = false;
  startupGateBypassed = false;
  startupGateMeasuredPlaybackRate = null;
  showStartupGate.value = false;
  startupGateTitle.value = '';
  startupGateDetail.value = '';
  startupGateCanBypass.value = false;
}

function updateStartupGate(title, detail, options = {}) {
  const { canBypass = false } = options;
  showStartupGate.value = true;
  startupGateTitle.value = title;
  startupGateDetail.value = detail;
  startupGateCanBypass.value = canBypass;
}

function formatPlaybackRateLabel(playbackRate) {
  if (!Number.isFinite(playbackRate)) {
    return '';
  }

  return `${playbackRate.toFixed(1)}x`;
}

function formatBufferedAheadLabel(bufferedAheadSeconds) {
  if (!(bufferedAheadSeconds > 0)) {
    return '0.0';
  }

  return bufferedAheadSeconds.toFixed(1);
}

function getBufferedAheadSeconds() {
  if (!player) return 0;

  const buffered = player.buffered?.();
  if (!buffered || buffered.length === 0) return 0;

  const currentTime = Number.isFinite(player.currentTime?.()) ? player.currentTime() : 0;

  for (let index = 0; index < buffered.length; index += 1) {
    const start = buffered.start(index);
    const end = buffered.end(index);

    if (currentTime >= start && currentTime <= end) {
      return Math.max(0, end - currentTime);
    }

    if (currentTime < start) {
      return Math.max(0, end - start);
    }
  }

  return 0;
}

function emitReadyStatus() {
  if (props.startTime > 0) {
    const formattedTime = formatTime(props.startTime);
    emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
    return;
  }

  emit('status-update', '播放器已就緒');
}

async function unlockStartupGate(seq = startupGateSourceSeq) {
  if (!player || seq !== sourceSeq || startupGateReady) return;

  startupGateReady = true;
  startupGateWaitingForBuffer = false;
  startupGateCanBypass.value = false;
  showStartupGate.value = false;

  if (props.shouldAutoplay) {
    if (player.readyState() >= 3) {
      await resumePlaybackIfNeeded();
      return;
    }

    player.one('canplay', () => {
      if (!player || seq !== sourceSeq) return;
      void resumePlaybackIfNeeded();
    });
    return;
  }

  emitReadyStatus();
}

function overrideStartupGate() {
  startupGateBypassed = true;
  void unlockStartupGate();
}

function updateStartupGateFromBuffer() {
  if (!player || !startupGateWaitingForBuffer || startupGateBypassed) return;

  const bufferedAheadSeconds = getBufferedAheadSeconds();
  const playbackRatePrefix = Number.isFinite(startupGateMeasuredPlaybackRate)
    ? `預載速度約 ${formatPlaybackRateLabel(startupGateMeasuredPlaybackRate)}，`
    : '';

  updateStartupGate(
    '正在累積可播緩衝',
    `${playbackRatePrefix}已緩衝 ${formatBufferedAheadLabel(bufferedAheadSeconds)} / ${STARTUP_BUFFER_THRESHOLD_SECONDS} 秒`,
    {
      canBypass: true,
    }
  );

  if (bufferedAheadSeconds >= STARTUP_BUFFER_THRESHOLD_SECONDS) {
    void unlockStartupGate();
  }
}

async function resumePlaybackIfNeeded() {
  if (!player || !props.shouldAutoplay) return;

  try {
    await player.play();
    emit('status-update', '播放器已就緒，繼續播放中');
  } catch (_) {
    if (props.startTime > 0) {
      const formattedTime = formatTime(props.startTime);
      emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
    } else {
      emit('status-update', '播放器已就緒，請手動播放');
    }
  }
}

function beginSourceSwitch() {
  if (!player) return 0;

  const seq = ++sourceSeq;
  resetStartupGate(seq);
  isSwitchingSource = true;
  resetSnapshotTracking();
  isApplyingSubtitlePreference = true;
  player.pause();
  clearTracks();
  player.reset();
  player.poster(props.posterUrl || '');
  isApplyingSubtitlePreference = false;
  return seq;
}

function bindSubtitleTrackChangeListener() {
  if (!player) return;

  const nextTextTrackList = player.textTracks();
  if (!nextTextTrackList) return;

  if (textTrackList === nextTextTrackList) {
    return;
  }

  if (textTrackList) {
    textTrackList.removeEventListener('change', handleSubtitleTrackChange);
  }

  textTrackList = nextTextTrackList;
  textTrackList.addEventListener('change', handleSubtitleTrackChange);
}

function applySubtitleTracks(subtitles, seq = sourceSeq) {
  if (!player || seq !== sourceSeq) return;

  isApplyingSubtitlePreference = true;
  clearTracks();
  bindSubtitleTrackChangeListener();

  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    isApplyingSubtitlePreference = false;
    return;
  }

  const subtitlePreference = resolveSubtitlePreference(subtitles);

  subtitles.forEach((sub) => {
    const shouldShow = subtitlePreference.mode === 'showing' && sub.lang === subtitlePreference.lang;
    const trackEl = player.addRemoteTextTrack(
      {
        kind: 'captions',
        label: sub.label,
        srclang: sub.lang,
        src: sub.src,
        default: false,
      },
      false
    );
    if (trackEl && trackEl.track) {
      trackEl.track.mode = shouldShow ? 'showing' : 'disabled';
    }
  });

  isApplyingSubtitlePreference = false;
}

async function setupSourceAndTracks(m3u8Url, subtitles) {
  if (!player) return;
  const seq = beginSourceSwitch();
  let warmupResult = null;

  if (shouldRunStartupWarmup()) {
    updateStartupGate('正在預載影片', `準備下載前 ${gatewayProbeSegmentSampleCount} 個片段`);
    emit('status-update', '正在預載前幾個片段...');

    warmupResult = await probeGatewayAvailability(props.gateway, props.cid, {
      cacheMode: 'default',
      segmentSampleCount: gatewayProbeSegmentSampleCount,
      playbackRateThreshold: gatewayProbePlaybackRateThreshold,
      onProgress(progressState) {
        if (!player || seq !== sourceSeq || progressState.state !== 'probing') return;

        const progressLabel =
          progressState.sampleSegmentCount > 0
            ? `已完成 ${progressState.completedSampleCount}/${progressState.sampleSegmentCount} 個片段`
            : '正在測速';
        const speedLabel = Number.isFinite(progressState.playbackRate)
          ? `，目前約 ${formatPlaybackRateLabel(progressState.playbackRate)}`
          : '';
        startupGateMeasuredPlaybackRate = Number.isFinite(progressState.playbackRate) ? progressState.playbackRate : null;

        updateStartupGate('正在預載影片', `${progressLabel}${speedLabel}`);
      },
    });

    if (!player || seq !== sourceSeq) return;
  }

  emit('status-update', '正在載入影片...');
  player.src({
    src: m3u8Url,
    type: 'application/x-mpegURL',
  });
  applySubtitleTracks(subtitles, seq);

  player.one('loadedmetadata', () => {
    if (!player || seq !== sourceSeq) return;

    if (props.startTime > 0) {
      player.currentTime(props.startTime);
    }
    isSwitchingSource = false;
    emitPlaybackSnapshot('loadedmetadata', { force: true });

    if (!shouldRunStartupWarmup()) {
      if (props.shouldAutoplay) {
        player.one('canplay', () => {
          if (!player || seq !== sourceSeq) return;
          void resumePlaybackIfNeeded();
        });
      } else {
        emitReadyStatus();
      }
      return;
    }

    if (warmupResult?.state === 'ready') {
      void unlockStartupGate(seq);
      return;
    }

    startupGateWaitingForBuffer = true;
    startupGateMeasuredPlaybackRate = Number.isFinite(warmupResult?.playbackRate) ? warmupResult.playbackRate : null;
    const warmupSpeedLabel = Number.isFinite(warmupResult?.playbackRate)
      ? `預載速度約 ${formatPlaybackRateLabel(warmupResult.playbackRate)}`
      : '預載速度仍在觀察';
    updateStartupGate('正在累積可播緩衝', `${warmupSpeedLabel}，等待緩衝達到 ${STARTUP_BUFFER_THRESHOLD_SECONDS} 秒`, {
      canBypass: true,
    });
    emit('status-update', '正在累積可播緩衝...');
    updateStartupGateFromBuffer();
  });
}

function clearTracks() {
  if (!player) return;

  const oldTracks = player.remoteTextTracks();
  if (!oldTracks) return;

  let i = oldTracks.length;
  while (i--) {
    player.removeRemoteTextTrack(oldTracks[i]);
  }
}

function handleSubtitleTrackChange() {
  if (!player || isApplyingSubtitlePreference) return;

  const activeLang = getActiveSubtitleLanguage();
  const target = typeof window !== 'undefined' ? window : null;
  const currentPreference = readStoredSubtitlePreference(target);
  const nextPreference = reconcileSubtitlePreference(
    {
      mode: activeLang ? 'showing' : 'off',
      lang: activeLang || currentPreference.lang,
    },
    props.subtitles,
    target?.navigator
  );

  persistSubtitlePreference(nextPreference, target);
}

function syncStartTime(startTime) {
  if (!player || !(startTime > 0)) return;

  const applySeek = () => {
    if (player) {
      player.currentTime(startTime);
    }
  };

  if (player.readyState() > 0) {
    applySeek();
  } else {
    player.one('loadedmetadata', applySeek);
  }

  const formattedTime = formatTime(startTime);
  emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
}

function handleGlobalKeydown(event) {
  if (showStartupGate.value) {
    return;
  }

  if (isHotkeyHelpOpen.value) {
    if (isEscapeKey(event) || isHelpHotkeyEvent(event)) {
      event.preventDefault?.();
      if (isEscapeKey(event)) {
        closeHotkeyHelp();
      } else {
        toggleHotkeyHelp();
      }
    }
    return;
  }

  applyPlaybackHotkey(event, player, {
    seekStepSeconds: SEEK_STEP_SECONDS,
    longSeekStepSeconds: LONG_SEEK_STEP_SECONDS,
    frameRate: props.frameRate,
    onToggleHelp: toggleHotkeyHelp,
    onToggleSubtitles: toggleSubtitleVisibility,
  });
}

function resetSnapshotTracking() {
  lastProgressSnapshotTime = -1;
}

function emitPlaybackSnapshot(reason, options = {}) {
  if (!player || isSwitchingSource) return;

  const snapshot = getPlayerPlaybackSnapshot(player);
  if (!options.force && reason === 'timeupdate') {
    if (snapshot.hasEnded || snapshot.time <= 0) {
      return;
    }

    if (lastProgressSnapshotTime >= 0 && snapshot.time - lastProgressSnapshotTime < PROGRESS_EMIT_STEP_SECONDS) {
      return;
    }
  }

  if (reason === 'timeupdate') {
    lastProgressSnapshotTime = snapshot.time;
  } else if (snapshot.time > 0 || snapshot.hasEnded) {
    lastProgressSnapshotTime = snapshot.time;
  }

  emit('playback-snapshot', {
    ...snapshot,
  });
}

function handlePauseSnapshot() {
  emitPlaybackSnapshot('pause', { force: true });
}

function handleEndedSnapshot() {
  emitPlaybackSnapshot('ended', { force: true });
}

function handleSeekedSnapshot() {
  emitPlaybackSnapshot('seeked', { force: true });
}

function handleTimeupdateSnapshot() {
  emitPlaybackSnapshot('timeupdate');
}

function bindPlaybackSnapshotListeners() {
  if (!player) return;

  player.on('pause', handlePauseSnapshot);
  player.on('ended', handleEndedSnapshot);
  player.on('seeked', handleSeekedSnapshot);
  player.on('timeupdate', handleTimeupdateSnapshot);
}

function bindStartupGateListeners() {
  if (!player) return;

  player.on('progress', updateStartupGateFromBuffer);
  player.on('canplay', updateStartupGateFromBuffer);
  player.on('loadeddata', updateStartupGateFromBuffer);
}

function syncPoster(posterUrl) {
  if (!player) return;

  player.poster(posterUrl || '');
}

function initPlayer() {
  if (!videoRef.value) return;

  player = videojs(
    videoRef.value,
    {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      html5: {
        vhs: {
          overrideNative: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      plugins: {
        hlsQualitySelector: {
          displayCurrentQuality: true,
        },
      },
    },
    () => {
      bindPlaybackSnapshotListeners();
      bindStartupGateListeners();
      syncPoster(props.posterUrl);
      emit('status-update', '播放器已就緒');
      if (props.m3u8Url) {
        void setupSourceAndTracks(props.m3u8Url, props.subtitles);
      }
    }
  );
}

onMounted(() => {
  initPlayer();
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch(
  () => [props.m3u8Url, props.startTime],
  ([newUrl, newStartTime], [oldUrl, oldStartTime] = []) => {
    if (!player) return;

    if (!newUrl) {
      beginSourceSwitch();
      emit('status-update', '準備就緒');
      return;
    }

    if (newUrl !== oldUrl) {
      void setupSourceAndTracks(newUrl, props.subtitles);
      return;
    }

    if (newStartTime !== oldStartTime) {
      if (newStartTime > 0) {
        syncStartTime(newStartTime);
      } else if (player.readyState() > 0) {
        player.currentTime(0);
        emit('status-update', '播放器已就緒');
      }
    }
  }
);

watch(
  () => props.subtitles,
  (newSubtitles) => {
    if (!player || !props.m3u8Url) return;
    applySubtitleTracks(newSubtitles);
  },
  { deep: true }
);

watch(
  () => props.posterUrl,
  (newPosterUrl) => {
    syncPoster(newPosterUrl);
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  if (textTrackList) {
    textTrackList.removeEventListener('change', handleSubtitleTrackChange);
    textTrackList = null;
  }
  if (player) {
    emitPlaybackSnapshot('before-unmount', { force: true });
    player.dispose();
  }
});
</script>

<style>
.video-player-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-player-shell [data-vjs-player] {
  width: 100%;
  height: 100%;
}

.startup-gate {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  color: #f6f7fb;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.76), rgba(7, 10, 18, 0.9)),
    radial-gradient(circle at top, rgba(92, 163, 255, 0.18), transparent 48%);
  backdrop-filter: blur(8px);
}

.startup-gate-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 30rem;
}

.startup-gate-title,
.startup-gate-detail {
  margin: 0;
}

.startup-gate-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.startup-gate-detail {
  color: rgba(246, 247, 251, 0.82);
  line-height: 1.5;
}

.startup-gate-action {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  color: #f6f7fb;
  background: rgba(255, 255, 255, 0.14);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}

.startup-gate-action:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.hotkey-help-backdrop {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(7, 9, 16, 0.54), rgba(7, 9, 16, 0.8)),
    radial-gradient(circle at 18% 14%, rgba(162, 82, 255, 0.14), transparent 30%),
    radial-gradient(circle at 84% 12%, rgba(0, 210, 255, 0.1), transparent 26%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.hotkey-help-dialog {
  width: min(400px, calc(100vw - 24px));
  max-height: min(500px, calc(100vh - 24px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(18, 21, 36, 0.96), rgba(11, 14, 26, 0.98)),
    radial-gradient(circle at top right, rgba(0, 210, 255, 0.08), transparent 38%);
  color: #f4f7fb;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.48);
}

.hotkey-help-dialog:focus {
  outline: 2px solid rgba(0, 210, 255, 0.45);
  outline-offset: 2px;
}

.hotkey-help-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.hotkey-help-copy {
  min-width: 0;
  max-width: 22rem;
}

.hotkey-help-copy h2 {
  margin: 4px 0 8px;
  font-size: clamp(1.02rem, 0.96rem + 0.32vw, 1.18rem);
  line-height: 1.12;
}

.hotkey-help-kicker {
  margin: 0;
  color: rgba(180, 213, 255, 0.82);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hotkey-help-summary {
  margin: 0;
  color: rgba(232, 238, 246, 0.78);
  font-size: 0.76rem;
  line-height: 1.38;
}

.hotkey-help-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 0;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.hotkey-help-close:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.hotkey-help-body {
  min-height: 0;
  overflow: auto;
  padding: 10px 14px 12px;
  display: grid;
  gap: 12px;
  overscroll-behavior: contain;
}

.hotkey-help-section {
  display: grid;
  gap: 8px;
}

.hotkey-help-section-header {
  margin-bottom: -2px;
}

.hotkey-help-section-title {
  margin: 0;
  color: rgba(244, 247, 251, 0.96);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hotkey-help-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.hotkey-help-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(86px, 102px) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 10px 10px 11px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.hotkey-help-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.hotkey-chip {
  min-width: 28px;
  padding: 4px 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f7fb;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
}

.hotkey-chip--inline {
  min-width: auto;
  padding-inline: 8px;
  font-size: 0.74rem;
}

.hotkey-help-label {
  min-width: 0;
  font-size: 0.84rem;
  line-height: 1.25;
  font-weight: 600;
}

.hotkey-help-detail {
  color: rgba(232, 238, 246, 0.62);
  font-size: 0.72rem;
  line-height: 1.2;
  white-space: nowrap;
  text-align: right;
}

.hotkey-help-hint {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(232, 238, 246, 0.72);
  font-size: 0.72rem;
  line-height: 1.2;
}

/* 確保畫質切換圖示正常顯示 */
.vjs-quality-selector .vjs-menu-button-popup .vjs-menu {
  display: block;
}

@media (max-width: 720px) {
  .hotkey-help-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .hotkey-help-dialog {
    width: 100%;
    max-height: min(54vh, calc(100vh - env(safe-area-inset-top, 0px) - 4px));
    border-radius: 18px 18px 0 0;
  }

  .hotkey-help-header {
    padding: 12px 12px 8px;
  }

  .hotkey-help-copy h2 {
    margin-bottom: 6px;
    font-size: 0.96rem;
  }

  .hotkey-help-kicker {
    font-size: 0.64rem;
  }

  .hotkey-help-summary {
    font-size: 0.72rem;
  }

  .hotkey-help-body {
    padding: 8px 12px 10px;
    gap: 10px;
  }

  .hotkey-help-list {
    gap: 5px;
  }

  .hotkey-help-row {
    grid-template-columns: minmax(74px, 88px) minmax(0, 1fr);
    gap: 8px;
    padding: 9px 9px 9px 10px;
  }

  .hotkey-help-label {
    font-size: 0.8rem;
  }

  .hotkey-help-detail {
    grid-column: 2;
    white-space: normal;
    text-align: left;
    font-size: 0.68rem;
  }

  .hotkey-help-hint {
    padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    font-size: 0.68rem;
  }
}

@media (max-width: 420px) {
  .hotkey-help-dialog {
    max-height: min(50vh, calc(100vh - env(safe-area-inset-top, 0px) - 2px));
  }

  .hotkey-help-row {
    grid-template-columns: minmax(68px, 82px) minmax(0, 1fr);
  }

  .hotkey-chip {
    min-width: 24px;
    padding: 3px 6px;
    font-size: 0.72rem;
  }
}
</style>
