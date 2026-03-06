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
      sources: [
        {
          src: 'http://127.0.0.1:8080/ipfs/QmX6BxaepGscMHoUz4KKbGBAhAyhWrJUNRjQJzKW7AxAHx/index.m3u8',
          type: 'application/x-mpegURL',
        },
      ],
      tracks: [
        {
          kind: 'captions',
          label: '繁體中文',
          srclang: 'zh-TW',
          src: 'http://127.0.0.1:8080/ipfs/QmX6BxaepGscMHoUz4KKbGBAhAyhWrJUNRjQJzKW7AxAHx/zh-TW.vtt',
          default: true,
        },
        {
          kind: 'captions',
          label: 'English',
          srclang: 'en',
          src: 'http://127.0.0.1:8080/ipfs/QmX6BxaepGscMHoUz4KKbGBAhAyhWrJUNRjQJzKW7AxAHx/en.vtt',
        },
      ],
    },
    () => {
      player.hlsQualitySelector({ displayCurrentQuality: true });
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
