<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import WatchPage from './components/WatchPage.vue';
import HistoryPage from './components/HistoryPage.vue';
import RecommendationsPage from './components/RecommendationsPage.vue';
import {
  buildGatewayAssetUrl,
  defaultPublicGateway,
  isLoopbackGatewayUrl,
  normalizeGatewayUrl,
  persistGateway,
  readStoredGateway,
} from './utils/gateway';
import { createDefaultVideoInfo, fetchVideoInfo } from './utils/videoInfo';
import {
  fetchSubtitleManifest,
  mergeSubtitleTracks,
  persistSubtitlePreference,
  resolveSubtitleTracks,
  revokeImportedSubtitleTracks,
} from './utils/subtitles';
import { parsePlayerParams } from './utils/url';
import { getPlaybackSnapshot } from './utils/playback';
import {
  clearHistory as clearStoredHistory,
  readStoredHistory,
  removeHistoryEntry,
  upsertHistoryEntry,
} from './utils/history';

const allowPrivateGateways = import.meta.env.DEV;
const DEFAULT_GATEWAY = defaultPublicGateway;
const status = ref('準備就緒');
const currentM3u8Url = ref('');
const currentIpfsBaseUrl = ref('');
const currentPosterUrl = ref('');
const currentVideoInfo = ref(createDefaultVideoInfo());
const currentRemoteSubtitleTracks = ref([]);
const currentImportedSubtitleTracks = ref([]);
const currentSubtitleTracks = computed(() =>
  mergeSubtitleTracks(currentRemoteSubtitleTracks.value, currentImportedSubtitleTracks.value)
);
const currentStartTime = ref(0);
const currentShouldAutoplay = ref(false);
const currentCid = ref('');
const currentGateway = ref(DEFAULT_GATEWAY);
const currentLoadSequence = ref(0);
const activeView = ref('home');
const historyItems = ref([]);
const isSidebarOpen = ref(false);

let originalPushState = null;
let originalReplaceState = null;
let metadataRequestSeq = 0;

function resetPlaybackState() {
  metadataRequestSeq += 1;
  currentCid.value = '';
  currentM3u8Url.value = '';
  currentIpfsBaseUrl.value = '';
  currentPosterUrl.value = '';
  currentVideoInfo.value = createDefaultVideoInfo();
  clearImportedSubtitles();
  currentRemoteSubtitleTracks.value = [];
  currentStartTime.value = 0;
  currentShouldAutoplay.value = false;
  status.value = '準備就緒';
}

function normalizeLocale(value) {
  return typeof value === 'string' ? value.trim().replace(/_/g, '-').toLowerCase() : '';
}

function clearImportedSubtitles() {
  revokeImportedSubtitleTracks(currentImportedSubtitleTracks.value);
  currentImportedSubtitleTracks.value = [];
}

function replaceImportedSubtitle(nextTrack) {
  const nextLocale = normalizeLocale(nextTrack?.lang);
  const remainingTracks = [];

  currentImportedSubtitleTracks.value.forEach((track) => {
    if (normalizeLocale(track?.lang) === nextLocale) {
      revokeImportedSubtitleTracks([track]);
      return;
    }

    remainingTracks.push(track);
  });

  currentImportedSubtitleTracks.value = [...remainingTracks, nextTrack].sort((left, right) => left.order - right.order);
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
  const storedGateway = readConfiguredGateway();
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
    activeView.value = 'home';
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
  refreshHistory();
  startUrlSync();
  syncFromUrl();
  startHistorySync();
});

onBeforeUnmount(() => {
  stopHistorySync();
  stopUrlSync();
  clearImportedSubtitles();
});

function onSearchCid(cid, time = 0) {
  if (!cid) return;
  loadVideo(cid, currentGateway.value, time, { updateUrl: true });
  activeView.value = 'home';
}

function onGatewayChange(gateway) {
  const nextGateway = resolveGateway(gateway);
  if (currentCid.value && activeView.value === 'home') {
    const snapshot = getPlaybackSnapshot(window);
    loadVideo(currentCid.value, nextGateway, snapshot.time, {
      updateUrl: true,
      shouldAutoplay: snapshot.isPlaying,
    });
    return;
  }

  currentGateway.value = nextGateway;
  persistGateway(nextGateway, window);
}

function loadVideo(cid, gateway, startTime = 0, options = {}) {
  const { updateUrl = true, shouldAutoplay = false } = options;
  const nextGateway = resolveGateway(gateway || readConfiguredGateway());
  const requestSeq = ++metadataRequestSeq;

  persistCurrentHistory();
  const shouldClearImportedSubtitles = currentCid.value && currentCid.value !== cid;
  currentCid.value = cid;
  currentGateway.value = nextGateway;
  currentLoadSequence.value += 1;
  persistGateway(nextGateway, window);

  const ipfsBaseUrl = buildGatewayAssetUrl(nextGateway, cid);
  const m3u8Url = buildGatewayAssetUrl(nextGateway, cid, 'index.m3u8');
  const posterUrl = buildGatewayAssetUrl(nextGateway, cid, 'cover.webp');
  status.value = '正在連線至網關...';
  
  currentIpfsBaseUrl.value = ipfsBaseUrl;
  currentM3u8Url.value = m3u8Url;
  currentPosterUrl.value = posterUrl;
  currentVideoInfo.value = createDefaultVideoInfo();
  if (shouldClearImportedSubtitles) {
    clearImportedSubtitles();
  }
  currentRemoteSubtitleTracks.value = [];
  currentStartTime.value = startTime;
  currentShouldAutoplay.value = shouldAutoplay;
  persistHistoryEntry({
    cid,
    posterUrl,
    gateway: nextGateway,
    progressSeconds: startTime,
    lastWatchedAt: Date.now(),
  });
  void loadSidecarAssets(ipfsBaseUrl, requestSeq);

  if (updateUrl) {
    syncPlayerUrl(cid, startTime, 'push');
  }
}

function onStatusUpdate(newStatus) {
  status.value = newStatus;
}

function onLevelsLoaded(levels) {}

function onGatewayFallbackRequest(payload = {}) {
  const cid = typeof payload?.cid === 'string' ? payload.cid.trim() : '';
  const failedGateway = typeof payload?.gateway === 'string' ? payload.gateway.trim() : '';

  if (!cid || cid !== currentCid.value || failedGateway !== currentGateway.value || !isLoopbackGatewayUrl(failedGateway)) {
    return;
  }

  loadVideo(cid, defaultPublicGateway, payload.startTime || 0, {
    updateUrl: false,
    shouldAutoplay: payload.shouldAutoplay === true,
  });
}

function onSubtitleImport(importedTrack) {
  if (!importedTrack) {
    return;
  }

  replaceImportedSubtitle(importedTrack);
  persistSubtitlePreference(
    {
      mode: 'showing',
      lang: importedTrack.lang,
    },
    window
  );
}

function onSubtitleRemove(trackId) {
  const nextImportedTracks = [];

  currentImportedSubtitleTracks.value.forEach((track) => {
    if (track.id === trackId) {
      revokeImportedSubtitleTracks([track]);
      return;
    }

    nextImportedTracks.push(track);
  });

  currentImportedSubtitleTracks.value = nextImportedTracks;
}

async function loadSidecarAssets(ipfsBaseUrl, requestSeq) {
  const [nextVideoInfo, subtitleManifest] = await Promise.all([
    fetchVideoInfo(ipfsBaseUrl).catch(() => createDefaultVideoInfo()),
    fetchSubtitleManifest(ipfsBaseUrl),
  ]);

  if (requestSeq !== metadataRequestSeq) return;

  currentVideoInfo.value = nextVideoInfo;
  currentRemoteSubtitleTracks.value = resolveSubtitleTracks(ipfsBaseUrl, subtitleManifest);
  const snapshot = activeView.value === 'home' ? getPlaybackSnapshot(window) : null;
  persistHistoryEntry({
    cid: currentCid.value,
    title: nextVideoInfo.title,
    uploader: nextVideoInfo.uploader,
    posterUrl: currentPosterUrl.value,
    gateway: currentGateway.value,
    durationString: nextVideoInfo.durationString,
    durationSeconds: snapshot?.duration ?? 0,
    progressSeconds: snapshot?.hasEnded && snapshot.duration > 0 ? snapshot.duration : snapshot?.time ?? 0,
    lastWatchedAt: Date.now(),
  });
  persistCurrentHistory();
}

function resolveGateway(candidate) {
  return normalizeGatewayUrl(candidate, { allowPrivateHosts: allowPrivateGateways }) || DEFAULT_GATEWAY;
}

function readConfiguredGateway() {
  const storedGateway = readStoredGateway(window);
  const normalized = normalizeGatewayUrl(storedGateway, { allowPrivateHosts: allowPrivateGateways });

  if (normalized) {
    return normalized;
  }

  if (storedGateway) {
    persistGateway('', window);
  }

  return '';
}

function refreshHistory() {
  historyItems.value = readStoredHistory(window);
}

function findHistoryEntry(cid) {
  const normalizedCid = typeof cid === 'string' ? cid.trim() : '';
  if (!normalizedCid) return null;

  return historyItems.value.find((item) => item.cid === normalizedCid) || null;
}

function persistHistoryEntry(entry) {
  historyItems.value = upsertHistoryEntry(entry, window);
}

function persistCurrentHistory(options = {}) {
  const { snapshot = null } = options;
  if (activeView.value !== 'home') return;

  const cid = currentCid.value.trim();
  if (!cid) return;

  const currentSnapshot = snapshot || getPlaybackSnapshot(window);
  const progressSeconds =
    currentSnapshot.hasEnded && currentSnapshot.duration > 0 ? currentSnapshot.duration : currentSnapshot.time;

  persistHistoryEntry({
    cid,
    title: currentVideoInfo.value.title,
    uploader: currentVideoInfo.value.uploader,
    posterUrl: currentPosterUrl.value,
    gateway: currentGateway.value,
    durationString: currentVideoInfo.value.durationString,
    durationSeconds: currentSnapshot.duration,
    progressSeconds,
    lastWatchedAt: Date.now(),
  });
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    persistCurrentHistory();
  }
}

function handlePageHide() {
  persistCurrentHistory();
}

function startHistorySync() {
  window.addEventListener('beforeunload', handlePageHide);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopHistorySync() {
  window.removeEventListener('beforeunload', handlePageHide);
  window.removeEventListener('pagehide', handlePageHide);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function onViewSelect(nextView) {
  if (nextView === 'history') {
    persistCurrentHistory();
    refreshHistory();
    activeView.value = 'history';
    closeSidebar();
    return;
  }

  if (activeView.value === 'history' && currentCid.value) {
    const currentHistoryEntry = findHistoryEntry(currentCid.value);
    const resumeTime =
      Number.isFinite(currentHistoryEntry?.progressSeconds) && currentHistoryEntry.progressSeconds > 0
        ? currentHistoryEntry.progressSeconds
        : currentStartTime.value;

    loadVideo(currentCid.value, currentGateway.value, resumeTime, {
      updateUrl: false,
      shouldAutoplay: false,
    });
  }

  activeView.value = 'home';
  closeSidebar();
}

function onHistorySelect(item) {
  if (!item?.cid) return;
  loadVideo(item.cid, currentGateway.value, item.progressSeconds || 0, { updateUrl: true });
  activeView.value = 'home';
}

function onHistoryRemove(cid) {
  historyItems.value = removeHistoryEntry(cid, window);
}

function onHistoryClear() {
  historyItems.value = clearStoredHistory(window);
}

function onPlaybackSnapshot(snapshot) {
  if (!snapshot || activeView.value !== 'home') return;
  persistCurrentHistory({ snapshot });
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function closeSidebar() {
  isSidebarOpen.value = false;
}
</script>

<template>
  <Header
    @search="onSearchCid"
    :current-gateway="currentGateway"
    :current-cid="currentCid"
    :current-load-sequence="currentLoadSequence"
    :sidebar-open="isSidebarOpen"
    @gateway-change="onGatewayChange"
    @toggle-sidebar="toggleSidebar"
  />
  <div class="app-container">
    <button
      v-if="isSidebarOpen"
      type="button"
      class="sidebar-backdrop"
      aria-label="Close navigation menu"
      data-testid="sidebar-backdrop"
      @click="closeSidebar"
    ></button>
    <Sidebar :active-view="activeView" :open="isSidebarOpen" @view-select="onViewSelect" />
    <main class="main-content" data-testid="main-content">
      <template v-if="activeView === 'history'">
        <HistoryPage
          :items="historyItems"
          @select="onHistorySelect"
          @remove="onHistoryRemove"
          @clear="onHistoryClear"
        />
      </template>
      <template v-else>
        <WatchPage
          :cid="currentCid"
          :gateway="currentGateway"
          :ipfs-base-url="currentIpfsBaseUrl"
          :m3u8-url="currentM3u8Url"
          :poster-url="currentPosterUrl"
          :subtitles="currentSubtitleTracks"
          :remote-subtitles="currentRemoteSubtitleTracks"
          :imported-subtitles="currentImportedSubtitleTracks"
          :start-time="currentStartTime"
          :should-autoplay="currentShouldAutoplay"
          :video-info="currentVideoInfo"
          @status-update="onStatusUpdate"
          @gateway-fallback-request="onGatewayFallbackRequest"
          @levels-loaded="onLevelsLoaded"
          @playback-snapshot="onPlaybackSnapshot"
          @subtitle-import="onSubtitleImport"
          @subtitle-remove="onSubtitleRemove"
        />
        <RecommendationsPage />
      </template>
    </main>
  </div>
</template>

<style src="./App.css"></style>
