<script setup>
// 引入必要的套件與客製化 hook
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import '../styles/plyr-override.css';
import { useSubtitles } from '../composables/useSubtitles';

// 定義組件接收的屬性與對外發送的事件
const props = defineProps({
  m3u8Url: String,
  ipfsBaseUrl: String,
  startTime: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['status-update', 'levels-loaded']);

// 初始化播放器所需的各項響應式狀態與實例變數
const videoElement = ref(null);
const videoKey = ref(0);
const status = ref('準備就緒');
const subtitles = ref([]);
const loadState = ref('idle');
let plyr = null;
let hlsInstance = null;

const { detectSubtitles } = useSubtitles();
let lastSubtitleBase = '';

// 處理組件掛載時的初始設定
onMounted(() => {});

// 初始化或重置 Plyr 播放器實例並配置相關設定
const initPlyr = (videoEl, targetQualities = [0], defaultQuality = 0) => {
  if (plyr) {
    plyr.destroy();
    plyr = null;
  }
  plyr = new Plyr(videoEl, {
    controls: [
      'play-large',
      'play',
      'progress',
      'current-time',
      'duration',
      'mute',
      'volume',
      'captions',
      'settings',
      'fullscreen',
    ],
    settings: ['captions', 'quality', 'speed'],
    captions: {
      active: true,
      update: true,
      language: subtitles.value.length > 0 ? subtitles.value[0].lang : 'auto',
    },
    quality: {
      default: defaultQuality,
      options: targetQualities,
      forced: true,
      onChange: (newQuality) => {
        if (hlsInstance) {
          if (newQuality === 0) {
            hlsInstance.currentLevel = -1;
          } else {
            const levelIndex = hlsInstance.levels.findIndex(
              (l) => l.height === newQuality
            );
            if (levelIndex !== -1) {
              hlsInstance.currentLevel = levelIndex;
            }
          }
        }
      },
    },
    i18n: {
      qualityLabel: {
        0: 'Auto',
      },
    },
  });
};

// 處理影片載入邏輯與 HLS 實例的建立、事件綁定
const loadVideo = async () => {
  if (!props.m3u8Url) {
    status.value = '無效的 M3U8 URL';
    emit('status-update', status.value);
    return;
  }

  loadState.value = 'loading';
  status.value = '正在嘗試載入…';
  emit('status-update', status.value);

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (plyr) {
    plyr.destroy();
    plyr = null;
  }

  videoKey.value += 1;

  try {
    const headResponse = await fetch(props.m3u8Url, {
      method: 'HEAD',
      mode: 'cors',
    });
    if (!headResponse.ok) {
      status.value = `錯誤: 無法訪問 M3U8 文件 (HTTP ${headResponse.status})。請檢查 CID 和網關。`;
      loadState.value = 'error';
      emit('status-update', status.value);
      return;
    }
  } catch (err) {
    status.value = `錯誤: 無法連接到網關。${err.message}`;
    loadState.value = 'error';
    emit('status-update', status.value);
    return;
  }

  if (
    props.ipfsBaseUrl &&
    (subtitles.value.length === 0 || props.ipfsBaseUrl !== lastSubtitleBase)
  ) {
    subtitles.value = await detectSubtitles(props.ipfsBaseUrl);
    lastSubtitleBase = props.ipfsBaseUrl;
  }

  await nextTick();

  const videoEl = videoElement.value;

  if (Hls.isSupported()) {
    const hlsConfig =
      props.startTime > 0
        ? {
            startPosition: props.startTime,
            renderTextTracksNatively: false,
            subtitleDisplay: false,
          }
        : { renderTextTracksNatively: false, subtitleDisplay: false };
    hlsInstance = new Hls(hlsConfig);
    hlsInstance.loadSource(props.m3u8Url);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.FRAG_LOADING, (event, data) => {
      if (props.ipfsBaseUrl && data && data.frag && data.frag.url) {
        try {
          const base = props.ipfsBaseUrl.replace(/\/+$/, '');
          const idx = data.frag.url.indexOf('/ipfs/');
          if (idx !== -1) {
            const suffix = data.frag.url.slice(idx + 6);
            const parts = suffix.split('/').slice(1).join('/');
            const newUrl = `${base}/${parts}`;
            if (newUrl !== data.frag.url) {
              data.frag.url = newUrl;
            }
          }
        } catch (e) {}
      }
    });

    hlsInstance.on(Hls.Events.FRAG_LOADED, (event, data) => {});
    hlsInstance.on(Hls.Events.FRAG_BUFFERED, (event, data) => {});
    hlsInstance.on(Hls.Events.LEVEL_LOADED, (event, data) => {});

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      const availableSizes = hlsInstance.levels.map((l) => l.height);
      availableSizes.unshift(0);

      const defaultSize = availableSizes[0];

      initPlyr(videoEl, availableSizes, defaultSize);

      emit('levels-loaded', hlsInstance.levels);

      status.value = '已解析 manifest，緩衝中...';
      loadState.value = 'buffering';
      emit('status-update', status.value);

      const onPlaying = () => {
        status.value = '播放中';
        loadState.value = 'ready';
        emit('status-update', status.value);
        videoEl.removeEventListener('playing', onPlaying);
      };
      videoEl.addEventListener('playing', onPlaying);

      status.value = '影片已準備好，請點擊播放按鈕開始。';
      emit('status-update', status.value);
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            status.value = `網絡錯誤：無法連接到網關。請確保本地IPFS網關正在運行或選擇其他網關。(${data.details})`;
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            status.value = `媒體錯誤：${data.details}`;
            break;
          default:
            status.value = `播放錯誤：${data.details}`;
        }

        loadState.value = 'error';
        emit('status-update', status.value);
      }
    });

    hlsInstance.on(Hls.Events.MANIFEST_INCOMPATIBLE_CODECS_ERROR, () => {
      status.value = '錯誤：視頻編碼不相容';
      loadState.value = 'error';
      emit('status-update', status.value);
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    initPlyr(videoEl, [0], 0);
    videoEl.src = props.m3u8Url;

    if (props.startTime > 0) {
      const handler = () => {
        videoEl.currentTime = props.startTime;
        videoEl.removeEventListener('loadedmetadata', handler);
      };
      videoEl.addEventListener('loadedmetadata', handler);
    }

    const onCanPlay = () => {
      status.value = '成功！';
      loadState.value = 'ready';
      emit('status-update', status.value);
      videoEl.removeEventListener('canplay', onCanPlay);
    };
    videoEl.addEventListener('canplay', onCanPlay);

    const onPlayingNative = () => {
      status.value = '播放中';
      loadState.value = 'ready';
      emit('status-update', status.value);
      videoEl.removeEventListener('playing', onPlayingNative);
    };
    videoEl.addEventListener('playing', onPlayingNative);

    status.value = '影片已準備好，請點擊播放按鈕開始。';
    emit('status-update', status.value);
  }
};

// 監聽 M3U8 URL 變更以重新載入影片
watch(
  () => props.m3u8Url,
  (newUrl, oldUrl) => {
    if (newUrl && newUrl !== oldUrl) {
      loadVideo();
    }
  }
);

// 組件卸載前清理實例以釋放資源
onBeforeUnmount(() => {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (plyr) {
    plyr.destroy();
    plyr = null;
  }
});

// 向父組件暴露載入影片的方法
defineExpose({
  loadVideo,
});
</script>

<template>
  <!-- 影片播放器容器與 DOM 結構設定 -->
  <div class="video-player-wrapper">
    <div style="width: 100%; height: 100%">
      <video
        ref="videoElement"
        :key="videoKey"
        controls
        crossorigin="anonymous"
        playsinline
        webkit-playsinline
        style="width: 100%; height: 100%"
      >
        <track
          v-for="(sub, index) in subtitles"
          :key="sub.lang"
          kind="captions"
          :label="sub.label"
          :srclang="sub.lang"
          :src="sub.src"
          :default="index === 0"
        />
      </video>
    </div>
  </div>
</template>

<style scoped src="./VideoPlayer.css"></style>
<style src="./VideoPlayerGlobal.css"></style>
