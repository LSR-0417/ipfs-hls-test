<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import VideoPlayer from './components/VideoPlayer.vue';
import VideoInfo from './components/VideoInfo.vue';
import VideoGrid from './components/VideoGrid.vue';
import { persistGateway, readStoredGateway } from './utils/gateway';
import { parsePlayerParams } from './utils/url';
import { getPlaybackSnapshot } from './utils/playback';

const DEFAULT_GATEWAY = 'http://127.0.0.1:8080/ipfs/';
const status = ref('準備就緒');
const currentM3u8Url = ref('');
const currentIpfsBaseUrl = ref('');
const currentStartTime = ref(0);
const currentShouldAutoplay = ref(false);
const playerRef = ref(null);
const currentCid = ref('');
const currentGateway = ref(DEFAULT_GATEWAY);

let originalPushState = null;
let originalReplaceState = null;

function resetPlaybackState() {
  currentCid.value = '';
  currentM3u8Url.value = '';
  currentIpfsBaseUrl.value = '';
  currentStartTime.value = 0;
  currentShouldAutoplay.value = false;
  status.value = '準備就緒';
}

function commitHistoryUrl(mode, url) {
  if (!window?.history) return;

  const method =
    mode === 'replace'
      ? originalReplaceState || window.history.replaceState
      : originalPushState || window.history.pushState;

  method.call(window.history, window.history.state, '', url);
}

function syncPlayerUrl(cid, time, mode = 'push') {
  const nextUrl = new URL(window.location.href);
  const currentHref = nextUrl.toString();

  if (cid) {
    nextUrl.searchParams.set('cid', cid);
  } else {
    nextUrl.searchParams.delete('cid');
  }

  nextUrl.searchParams.delete('gateway');

  if (cid && time > 0) {
    nextUrl.searchParams.set('t', time);
  } else {
    nextUrl.searchParams.delete('t');
  }

  if (nextUrl.toString() === currentHref) return;

  commitHistoryUrl(mode, nextUrl);
}

function syncFromUrl() {
  const { cid, time } = parsePlayerParams(window.location.search);
  const prevGateway = currentGateway.value;
  const storedGateway = readStoredGateway(window);
  const nextGateway = storedGateway || prevGateway || DEFAULT_GATEWAY;

  if (nextGateway !== currentGateway.value) {
    currentGateway.value = nextGateway;
  }

  if (cid) {
    const shouldReload =
      cid !== currentCid.value ||
      nextGateway !== prevGateway ||
      time !== currentStartTime.value ||
      !currentM3u8Url.value;
    if (shouldReload) {
      loadVideo(cid, nextGateway, time, { updateUrl: false });
    }
    return;
  }

  if (currentCid.value) {
    resetPlaybackState();
  }
}

function startUrlSync() {
  if (!window?.history) return;

  originalPushState = window.history.pushState;
  originalReplaceState = window.history.replaceState;

  const notify = () => window.dispatchEvent(new Event('urlchange'));

  window.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    notify();
  };
  window.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    notify();
  };

  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('urlchange', syncFromUrl);
}

function stopUrlSync() {
  window.removeEventListener('popstate', syncFromUrl);
  window.removeEventListener('urlchange', syncFromUrl);

  if (originalPushState) {
    window.history.pushState = originalPushState;
  }
  if (originalReplaceState) {
    window.history.replaceState = originalReplaceState;
  }
}

onMounted(() => {
  startUrlSync();
  syncFromUrl();
});

onBeforeUnmount(() => {
  stopUrlSync();
});

function onSearchCid(cid, time = 0) {
  if (!cid) return;
  currentCid.value = cid;
  loadVideo(cid, currentGateway.value, time, { updateUrl: true });
}

function onGatewayChange(gateway) {
  currentGateway.value = gateway;
  persistGateway(gateway, window);
  if (currentCid.value) {
    const snapshot = getPlaybackSnapshot(window);
    loadVideo(currentCid.value, gateway, snapshot.time, {
      updateUrl: true,
      shouldAutoplay: snapshot.isPlaying,
    });
  }
}

function loadVideo(cid, gateway, startTime = 0, options = {}) {
  const { updateUrl = true, shouldAutoplay = false } = options;
  const nextGateway = gateway || readStoredGateway(window) || DEFAULT_GATEWAY;
  currentCid.value = cid;
  currentGateway.value = nextGateway;
  persistGateway(nextGateway, window);

  const ipfsBaseUrl = `${nextGateway}${cid}/`;
  const m3u8Url = `${ipfsBaseUrl}index.m3u8`;
  status.value = '正在連線至網關...';
  
  currentIpfsBaseUrl.value = ipfsBaseUrl;
  currentM3u8Url.value = m3u8Url;
  currentStartTime.value = startTime;
  currentShouldAutoplay.value = shouldAutoplay;

  if (updateUrl) {
    syncPlayerUrl(cid, startTime, 'push');
  }
}

function onStatusUpdate(newStatus) {
  status.value = newStatus;
}

function onLevelsLoaded(levels) {}
</script>

<template>
  <Header
    @search="onSearchCid"
    :current-gateway="currentGateway"
    @gateway-change="onGatewayChange"
  />
  <div class="app-container">
    <Sidebar />
    <main class="main-content">
      
      <div class="video-layout">
        <div class="primary-column">
          <div class="player-container glass-panel">
            <VideoPlayer
              ref="playerRef"
              :m3u8-url="currentM3u8Url"
              :ipfs-base-url="currentIpfsBaseUrl"
              :start-time="currentStartTime"
              :should-autoplay="currentShouldAutoplay"
              @status-update="onStatusUpdate"
              @levels-loaded="onLevelsLoaded"
            />
          </div>
          <div id="status" class="status-msg">{{ status }}</div>

          <VideoInfo :cid="currentCid" />
        </div>
        
        <div class="secondary-column">
          <div class="recommendations-title">Recommended Next</div>
          <VideoGrid />
        </div>
      </div>

    </main>
  </div>
</template>

<style src="./App.css"></style>
<style scoped>
.video-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .video-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.primary-column {
  flex: 1;
  min-width: 0; /* allows text truncation if needed inside */
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.secondary-column {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 1024px) {
  .secondary-column {
    width: 380px;
    flex-shrink: 0;
  }
}

.player-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-container :deep(> div) {
  width: 100%;
  height: 100%;
}

.status-msg {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-style: italic;
  padding: 0 4px;
}

.recommendations-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
</style>
