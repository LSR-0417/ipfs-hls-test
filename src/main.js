import { createApp } from 'vue';
import App from './App.vue';

import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
window.videojs = videojs;

import 'videojs-contrib-quality-levels';
import 'videojs-hls-quality-selector';

createApp(App).mount('#app');
