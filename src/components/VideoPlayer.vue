<template>
  <div data-vjs-player>
    <video
      ref="videoRef"
      class="video-js vjs-big-play-centered"
      crossorigin="anonymous"
      playsinline
      webkit-playsinline
    ></video>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useSubtitles } from '../composables/useSubtitles';
import { formatTime } from '../utils/time';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
window.videojs = videojs;

const props = defineProps({
  m3u8Url: {
    type: String,
    required: false,
    default: '',
  },
  ipfsBaseUrl: {
    type: String,
    required: false,
    default: '',
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

const emit = defineEmits(['status-update', 'levels-loaded']);

const videoRef = ref(null);
let player = null;
let sourceSeq = 0;

const { detectSubtitles } = useSubtitles();

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
  player.pause();
  clearTracks();
  player.reset();
  return seq;
}

async function setupSourceAndTracks(m3u8Url, ipfsBaseUrl) {
  if (!player) return;
  const seq = beginSourceSwitch();

  // Switch the source first so gateway switching doesn't feel blocked by subtitle detection.
  emit('status-update', '正在載入影片...');
  player.src({
    src: m3u8Url,
    type: 'application/x-mpegURL',
  });

  player.one('loadedmetadata', () => {
    if (!player || seq !== sourceSeq) return;

    if (props.startTime > 0) {
      player.currentTime(props.startTime);
    }
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

  // Subtitle detection runs in background; apply only if this is the latest source switch.
  try {
    const availableSubtitles = await detectSubtitles(ipfsBaseUrl);
    if (seq !== sourceSeq) return;

    const oldTracks = player.remoteTextTracks();
    if (oldTracks) {
      let i = oldTracks.length;
      while (i--) {
        player.removeRemoteTextTrack(oldTracks[i]);
      }
    }

    if (availableSubtitles && availableSubtitles.length > 0) {
      availableSubtitles.forEach((sub) => {
        const isDefault = sub.lang === 'zh-TW';
        const trackEl = player.addRemoteTextTrack(
          {
            kind: 'captions',
            label: sub.label,
            srclang: sub.lang,
            src: sub.src,
            default: isDefault,
          },
          false
        );
        if (isDefault && trackEl && trackEl.track) {
          trackEl.track.mode = 'showing';
        }
      });
    }
  } catch (e) {
    // Subtitle detection failure shouldn't break playback.
    console.warn('[VideoPlayer] subtitle detection failed:', e);
  }
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
      emit('status-update', '播放器已就緒');
      if (props.m3u8Url) {
        setupSourceAndTracks(props.m3u8Url, props.ipfsBaseUrl);
      }
    }
  );
}

onMounted(() => {
  initPlayer();
});

watch(
  () => [props.m3u8Url, props.ipfsBaseUrl, props.startTime],
  ([newUrl, newBaseUrl, newStartTime], [oldUrl, oldBaseUrl, oldStartTime] = []) => {
    if (!player) return;

    if (!newUrl) {
      beginSourceSwitch();
      emit('status-update', '準備就緒');
      return;
    }

    if (newUrl !== oldUrl || newBaseUrl !== oldBaseUrl) {
      setupSourceAndTracks(newUrl, newBaseUrl);
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

onBeforeUnmount(() => {
  if (player) {
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
