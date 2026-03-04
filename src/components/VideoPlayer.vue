<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import '../styles/plyr-override.css';
import { useSubtitles } from '../composables/useSubtitles';

const props = defineProps({
  m3u8Url: String,
  ipfsBaseUrl: String,
  startTime: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['status-update', 'levels-loaded']);

const videoElement = ref(null);
const videoKey = ref(0);
const status = ref('準備就緒');
const subtitles = ref([]); // 加入響應式字幕陣列
const loadState = ref('idle'); // 'idle', 'loading', 'buffering', 'ready', 'error'
let plyr = null;
let hlsInstance = null;

const { detectSubtitles } = useSubtitles();
let lastSubtitleBase = ''; // track what we've already detected
onMounted(() => {
  // Plyr will be initialized dynamically upon video load to support qualities
});

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
            hlsInstance.currentLevel = -1; // Auto
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

const loadVideo = async () => {
  if (!props.m3u8Url) {
    status.value = '無效的 M3U8 URL';
    emit('status-update', status.value);
    return;
  }

  // start in loading state so the video element isn't shown before we
  // even have a source.  we still describe the upcoming buffering phase in
  // the status text, and the state is bumped to 'buffering' once the
  // manifest has been parsed.
  loadState.value = 'loading';
  status.value = '正在嘗試載入…';
  emit('status-update', status.value);

  // === 網關切換/載入新影片時的生命週期：清理舊資源 ===
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (plyr) {
    plyr.destroy();
    plyr = null;
  }

  // 更新 key 來觸發 Vue 完整銷毀舊的 <video> 元素並產生一個乾淨的
  videoKey.value += 1;
  // =================================================

  // Pre-check if m3u8 URL is accessible
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

  // subtitles should already have been populated when the base URL changed
  // (see ipfsBaseUrl watcher in setup).  If somehow we still lack subtitles,
  // perform a detection now and remember the base so we don't repeat later.
  if (
    props.ipfsBaseUrl &&
    (subtitles.value.length === 0 || props.ipfsBaseUrl !== lastSubtitleBase)
  ) {
    subtitles.value = await detectSubtitles(props.ipfsBaseUrl);
    lastSubtitleBase = props.ipfsBaseUrl;
  }

  await nextTick(); // 等待 Vue 響應式地將 <track> 標籤和全新的 <video> 渲染到 DOM 中

  const videoEl = videoElement.value;

  // Initialize HLS
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

    // rewrite any fragment requests so they use the current gateway base URL
    hlsInstance.on(Hls.Events.FRAG_LOADING, (event, data) => {
      if (props.ipfsBaseUrl && data && data.frag && data.frag.url) {
        try {
          const base = props.ipfsBaseUrl.replace(/\/+$/, ''); // no trailing slash
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
      // Extract heights for Plyr
      const availableSizes = hlsInstance.levels.map((l) => l.height);
      // Add 'Auto' (0) to the beginning
      availableSizes.unshift(0);

      const defaultSize = availableSizes[0]; // Default to Auto

      initPlyr(videoEl, availableSizes, defaultSize);

      emit('levels-loaded', hlsInstance.levels);

      status.value = '已解析 manifest，緩衝中...';
      loadState.value = 'buffering';
      emit('status-update', status.value);

      // when the first fragment is buffered or video starts playing we'll update
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
    // for native HLS we also don't set 'loading' state upfront
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

    // also listen to playing for fine-grained ready
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

// Watch for m3u8Url changes
watch(
  () => props.m3u8Url,
  (newUrl, oldUrl) => {
    if (newUrl && newUrl !== oldUrl) {
      loadVideo();
    }
  }
);

// Watch for gateway/base URL changes
// (Removed watcher because whenever gateway changes, m3u8Url also changes
// and the m3u8Url watcher will call loadVideo anyway, which handles subtitle detection.)

// Cleanup
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

// Expose methods for parent component to use
defineExpose({
  loadVideo,
});
</script>

<template>
  <div class="video-player-wrapper">
    <!-- 影片播放器 (永遠在 DOM 中且顯示) -->
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
