import { createApp } from 'vue';
import App from './App.vue';
import { createI18n } from './i18n';

import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
window.videojs = videojs;

import 'videojs-hls-quality-selector';

const app = createApp(App);
const i18n = createI18n({
  window,
});

app.use(i18n);
app.mount('#app');
