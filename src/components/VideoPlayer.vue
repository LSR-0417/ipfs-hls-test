<template>
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
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { formatTime } from '../utils/time';
import { applyPlaybackHotkey, getPlayerPlaybackSnapshot } from '../utils/playback';
import {
  persistSubtitlePreference,
  readStoredSubtitlePreference,
  reconcileSubtitlePreference,
} from '../utils/subtitles';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
window.videojs = videojs;

const props = defineProps({
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

const videoRef = ref(null);
const SEEK_STEP_SECONDS = 5;
const PROGRESS_EMIT_STEP_SECONDS = 5;
let player = null;
let sourceSeq = 0;
let isApplyingSubtitlePreference = false;
let textTrackList = null;
let isSwitchingSource = false;
let lastProgressSnapshotTime = -1;

function resolveSubtitlePreference(subtitles) {
  const target = typeof window !== 'undefined' ? window : null;
  const storedPreference = readStoredSubtitlePreference(target);
  const nextPreference = reconcileSubtitlePreference(storedPreference, subtitles, target?.navigator);

  if (storedPreference.mode !== nextPreference.mode || storedPreference.lang !== nextPreference.lang) {
    persistSubtitlePreference(nextPreference, target);
  }

  return nextPreference;
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

function setupSourceAndTracks(m3u8Url, subtitles) {
  if (!player) return;
  const seq = beginSourceSwitch();

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
    if (props.shouldAutoplay) {
      player.one('canplay', () => {
        if (!player || seq !== sourceSeq) return;
        void resumePlaybackIfNeeded();
      });
    } else if (props.startTime > 0) {
      const formattedTime = formatTime(props.startTime);
      emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
    } else {
      emit('status-update', '播放器已就緒');
    }
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

  const tracks = player.remoteTextTracks();
  if (!tracks) return;

  let activeLang = '';

  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track.mode === 'showing') {
      activeLang = track.language || track.srclang || '';
      break;
    }
  }

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
  applyPlaybackHotkey(event, player, SEEK_STEP_SECONDS);
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
      syncPoster(props.posterUrl);
      emit('status-update', '播放器已就緒');
      if (props.m3u8Url) {
        setupSourceAndTracks(props.m3u8Url, props.subtitles);
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
      setupSourceAndTracks(newUrl, props.subtitles);
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
/* 確保畫質切換圖示正常顯示 */
.vjs-quality-selector .vjs-menu-button-popup .vjs-menu {
  display: block;
}
</style>
