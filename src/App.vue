<script setup>
import { ref, onMounted } from 'vue';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import VideoPlayer from './components/VideoPlayer.vue';
import VideoInfo from './components/VideoInfo.vue';
import VideoGrid from './components/VideoGrid.vue';

const status = ref('準備就緒');
const currentM3u8Url = ref('');
const currentIpfsBaseUrl = ref('');
const currentStartTime = ref(0);
const playerRef = ref(null);
const currentCid = ref('');
const currentGateway = ref('http://127.0.0.1:8080/ipfs/');

// Listen to URL changes on mount
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const cidFromUrl = urlParams.get('cid');
  const timeFromUrl = parseInt(urlParams.get('t'), 10) || 0;
  const gatewayFromUrl = urlParams.get('gateway');

  if (gatewayFromUrl) {
    currentGateway.value = gatewayFromUrl;
  }
  if (cidFromUrl) {
    onSearchCid(cidFromUrl, timeFromUrl);
  }
});

function onSearchCid(cid, time = 0) {
  if (!cid) return;
  currentCid.value = cid;
  loadVideo(cid, currentGateway.value, time);
}

function onGatewayChange(gateway) {
  currentGateway.value = gateway;
  if (currentCid.value) {
    loadVideo(currentCid.value, gateway, currentStartTime.value);
  } else {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('gateway', gateway);
    window.history.pushState({}, '', currentUrl);
  }
}

function loadVideo(cid, gateway, startTime = 0) {
  const ipfsBaseUrl = `${gateway}${cid}/`;
  const m3u8Url = `${ipfsBaseUrl}index.m3u8`;
  status.value = '正在連線至網關...';
  
  currentIpfsBaseUrl.value = ipfsBaseUrl;
  currentM3u8Url.value = m3u8Url;
  currentStartTime.value = startTime;

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('cid', cid);
  currentUrl.searchParams.set('gateway', gateway);
  if (startTime > 0) {
    currentUrl.searchParams.set('t', startTime);
  } else {
    currentUrl.searchParams.delete('t');
  }
  window.history.pushState({}, '', currentUrl);
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
              @status-update="onStatusUpdate"
              @levels-loaded="onLevelsLoaded"
            />
          </div>
          <div id="status" class="status-msg">{{ status }}</div>

          <VideoInfo :cid="currentCid" :gateway="currentGateway" />
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
