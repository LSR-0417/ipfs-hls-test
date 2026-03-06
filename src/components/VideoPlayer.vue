<template>
  <div data-vjs-player>
    <video
      ref="videoRef"
      class="video-js vjs-big-play-centered"
      crossorigin="anonymous"
    ></video>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useSubtitles } from '../composables/useSubtitles';

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
});

const emit = defineEmits(['status-update', 'levels-loaded']);

const videoRef = ref(null);
let player = null;

const { detectSubtitles } = useSubtitles();

async function setupSourceAndTracks(m3u8Url, ipfsBaseUrl) {
  if (!player) return;

  // 清除舊字幕軌道
  const oldTracks = player.remoteTextTracks();
  if (oldTracks) {
    let i = oldTracks.length;
    while (i--) {
      player.removeRemoteTextTrack(oldTracks[i]);
    }
  }

  // 先偵測真正存在的字幕
  emit('status-update', '正在檢查可用字幕...');
  const availableSubtitles = await detectSubtitles(ipfsBaseUrl);
  emit('status-update', '播放器已就緒');

  // 先掛載影片來源
  player.src({
    src: m3u8Url,
    type: 'application/x-mpegURL',
  });

  // 動態新增字幕 (依據 useSubtitles 偵測結果)
  if (availableSubtitles && availableSubtitles.length > 0) {
    availableSubtitles.forEach((sub) => {
      // 若為繁中，預設開啟
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

      // 確保該字幕自動顯示
      if (isDefault && trackEl && trackEl.track) {
        trackEl.track.mode = 'showing';
      }
    });
  }

  if (props.startTime > 0) {
    player.currentTime(props.startTime);
  }
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
  () => props.m3u8Url,
  (newUrl) => {
    if (newUrl && player) {
      setupSourceAndTracks(newUrl, props.ipfsBaseUrl);
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
