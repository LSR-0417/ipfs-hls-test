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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
window.videojs = videojs;

const videoRef = ref(null);
let player = null;

onMounted(() => {
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
      tracks: [
        {
          kind: 'captions',
          label: '繁體中文',
          srclang: 'zh-TW',
          src: 'http://127.0.0.1:8080/ipfs/QmXD3mqDcBpFn51c6wDgKPVMCDMYNxA8W94aCpw5TuRLuQ/zh-TW.vtt',
          default: true,
        },
        {
          kind: 'captions',
          label: 'English',
          srclang: 'en',
          src: 'http://127.0.0.1:8080/ipfs/QmXD3mqDcBpFn51c6wDgKPVMCDMYNxA8W94aCpw5TuRLuQ/en.vtt',
        },
      ],
    },
    () => {
      // 確保播放器與外掛套件完全就緒後，再掛載影片來源
      // 這樣套件才能順利捕捉到 'addqualitylevel' 事件來產生解析度選單
      player.src({
        src: 'http://127.0.0.1:8080/ipfs/Qmd19GKkJy4cchnpFcLnZJZ7QsqL1z8fbuEsXygfVpDrbk/index.m3u8',
        type: 'application/x-mpegURL',
      });
    }
  );
});

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
