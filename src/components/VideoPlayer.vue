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

function setupSourceAndTracks(m3u8Url, ipfsBaseUrl) {
  if (!player) return;

  // 清除舊字幕軌道
  const oldTracks = player.remoteTextTracks();
  if (oldTracks) {
    let i = oldTracks.length;
    while (i--) {
      player.removeRemoteTextTrack(oldTracks[i]);
    }
  }

  // 先掛載影片來源
  player.src({
    src: m3u8Url,
    type: 'application/x-mpegURL',
  });

  // 動態新增字幕 (必須放在設完 src 之後，才不會在一開始因為來源變更而被清空)
  if (ipfsBaseUrl) {
    const twTrack = player.addRemoteTextTrack(
      {
        kind: 'captions',
        label: '繁體中文',
        srclang: 'zh-TW',
        src: `${ipfsBaseUrl}zh-TW.vtt`,
        default: true,
      },
      false
    );

    // 確保新增後這條字幕軌道會自動顯示
    if (twTrack && twTrack.track) {
      twTrack.track.mode = 'showing';
    }

    player.addRemoteTextTrack(
      {
        kind: 'captions',
        label: 'English',
        srclang: 'en',
        src: `${ipfsBaseUrl}en.vtt`,
      },
      false
    );
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
