<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Header from './components/Header.vue';
import HistoryPage from './components/HistoryPage.vue';
import RecommendationsPage from './components/RecommendationsPage.vue';
import SeriesPlaylistPage from './components/SeriesPlaylistPage.vue';
import Sidebar from './components/Sidebar.vue';
import WatchPage from './components/WatchPage.vue';
import {
  defaultPublicGateway,
  getDefaultGateway,
  isLoopbackGatewayUrl,
  normalizeGatewayUrl,
  persistGateway,
  readStoredGateway,
} from './utils/gateway';
import {
  buildPlayableEpisodeCid,
  checkDirectVideoAvailability,
  fetchPlaylistManifest,
  resolveSelectedPlaylistEpisode,
} from './utils/playlist';
import { getPlaybackSnapshot } from './utils/playback';
import {
  avatarAssetFileName,
  buildSidecarGatewayCandidates,
  loadAvatarUrlWithFallback,
  loadPosterUrlWithFallback,
  loadSubtitleCatalogWithFallback,
  loadVideoInfoWithFallback,
  posterAssetFileName,
  readCachedSidecarObjectUrl,
  readCachedSubtitleCatalog,
  readCachedVideoInfo,
} from './utils/sidecarAssets';
import {
  clearHistory as clearStoredHistory,
  readStoredHistory,
  removeHistoryEntry,
  upsertHistoryEntry,
} from './utils/history';
import {
  createDefaultSubtitlePreference,
  mergeSubtitleTracks,
  persistSubtitlePreference,
  readStoredSubtitlePreference,
  reconcileSubtitlePreference,
  revokeImportedSubtitleTracks,
  subtitleCatalogStatus,
} from './utils/subtitles';
import { parsePlayerParams } from './utils/url';
import { createDefaultVideoInfo } from './utils/videoInfo';

const allowPrivateGateways = import.meta.env.DEV;
const DEFAULT_GATEWAY = getDefaultGateway({ allowPrivateHosts: allowPrivateGateways });

const status = ref('準備就緒');
const currentSourceCid = ref('');
const currentSourceMode = ref('idle');
const currentSeriesTitle = ref('');
const currentSeriesEpisodes = ref([]);
const currentSeriesError = ref('');
const currentSeriesPlaylistLoading = ref(false);
const currentEpisodeId = ref('');
const currentEpisodePath = ref('');
const currentM3u8Url = ref('');
const currentIpfsBaseUrl = ref('');
const currentPosterUrl = ref('');
const currentHistoryPosterUrl = ref('');
const currentAvatarUrl = ref('');
const currentVideoInfo = ref(createDefaultVideoInfo());
const currentRemoteSubtitleTracks = ref([]);
const currentRemoteSubtitleStatus = ref(subtitleCatalogStatus.idle);
const currentImportedSubtitleTracks = ref([]);
const currentSubtitleTracks = computed(() =>
  mergeSubtitleTracks(currentRemoteSubtitleTracks.value, currentImportedSubtitleTracks.value)
);
const currentSubtitleSelection = ref(createDefaultSubtitlePreference());
const currentStartTime = ref(0);
const currentShouldAutoplay = ref(false);
const currentCid = ref('');
const currentGateway = ref(DEFAULT_GATEWAY);
const currentLoadSequence = ref(0);
const activeView = ref('home');
const historyItems = ref([]);
const isSidebarOpen = ref(false);
const sidecarGatewayCandidates = ref([]);
const currentHistoryAllowsReadyState = ref(true);
const hasCurrentPlaybackStarted = ref(false);
const isSeriesMode = computed(() => currentSourceMode.value === 'series');
const shouldShowSeriesPlaylist = computed(() => ['series', 'series-error'].includes(currentSourceMode.value));
const currentSelectedSeriesEpisode = computed(() => {
  if (currentEpisodeId.value) {
    const matchedEpisodeById = currentSeriesEpisodes.value.find((episode) => episode.id === currentEpisodeId.value);
    if (matchedEpisodeById) {
      return matchedEpisodeById;
    }
  }

  if (!currentEpisodePath.value) {
    return null;
  }

  return currentSeriesEpisodes.value.find((episode) => episode.path === currentEpisodePath.value) || null;
});

let originalPushState = null;
let originalReplaceState = null;
let metadataRequestSeq = 0;
let sourceRequestSeq = 0;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSeriesEpisodeVideoInfo(videoInfo = null, episode = null) {
  const sourceVideoInfo = videoInfo && typeof videoInfo === 'object' ? videoInfo : createDefaultVideoInfo();
  const sourceEpisode = episode && typeof episode === 'object' ? episode : {};

  return {
    ...createDefaultVideoInfo(),
    ...sourceVideoInfo,
    title: normalizeText(sourceEpisode.displayTitle || sourceEpisode.title || sourceVideoInfo.title),
    uploader: normalizeText(sourceEpisode.displayUploader || sourceEpisode.uploader || sourceVideoInfo.uploader),
    durationString: normalizeText(sourceEpisode.durationString || sourceVideoInfo.durationString),
  };
}

function buildSeriesEpisodeDisplayState(seriesCid, episode = {}, overrides = {}) {
  const episodeCid = buildPlayableEpisodeCid(seriesCid, episode);
  const cachedPosterUrl = episodeCid ? readCachedSidecarObjectUrl(episodeCid, posterAssetFileName) : '';
  const cachedVideoInfo = episodeCid ? readCachedVideoInfo(episodeCid) : null;
  const displayTitle = normalizeText(episode.displayTitle || episode.title || overrides.displayTitle || cachedVideoInfo?.title);
  const posterUrl = normalizeText(overrides.posterUrl ?? episode.posterUrl ?? cachedPosterUrl);
  const displayUploader = normalizeText(
    episode.displayUploader || episode.uploader || overrides.displayUploader || cachedVideoInfo?.uploader
  );
  const durationString = normalizeText(
    episode.durationString || overrides.durationString || cachedVideoInfo?.durationString
  );

  return {
    ...episode,
    displayTitle: displayTitle || episode.title || episode.id || episode.path || '',
    displayUploader,
    durationString,
    posterUrl,
  };
}

function buildSeriesEpisodeDisplayList(seriesCid, episodes = []) {
  return Array.isArray(episodes) ? episodes.map((episode) => buildSeriesEpisodeDisplayState(seriesCid, episode)) : [];
}

function patchSeriesEpisodeDisplayState(seriesCid, episodePath, overrides = {}) {
  if (!seriesCid || !episodePath || currentSourceCid.value !== seriesCid) {
    return;
  }

  let hasMatchedEpisode = false;
  const nextEpisodes = currentSeriesEpisodes.value.map((episode) => {
    if (episode?.path !== episodePath) {
      return episode;
    }

    hasMatchedEpisode = true;
    return buildSeriesEpisodeDisplayState(seriesCid, episode, overrides);
  });

  if (hasMatchedEpisode) {
    currentSeriesEpisodes.value = nextEpisodes;
  }
}

function resetSeriesState() {
  currentSourceCid.value = '';
  currentSourceMode.value = 'idle';
  currentSeriesTitle.value = '';
  currentSeriesEpisodes.value = [];
  currentSeriesError.value = '';
  currentSeriesPlaylistLoading.value = false;
  currentEpisodeId.value = '';
  currentEpisodePath.value = '';
}

function resetHistoryPersistenceTracking(allowReadyState = true) {
  currentHistoryAllowsReadyState.value = allowReadyState;
  hasCurrentPlaybackStarted.value = allowReadyState;
}

function resetLoadedMediaState(options = {}) {
  const { clearImported = true } = options;

  metadataRequestSeq += 1;
  currentCid.value = '';
  currentM3u8Url.value = '';
  currentIpfsBaseUrl.value = '';
  currentPosterUrl.value = '';
  currentHistoryPosterUrl.value = '';
  currentAvatarUrl.value = '';
  currentVideoInfo.value = createDefaultVideoInfo();
  if (clearImported) {
    clearImportedSubtitles();
  }
  currentRemoteSubtitleTracks.value = [];
  currentRemoteSubtitleStatus.value = subtitleCatalogStatus.idle;
  currentStartTime.value = 0;
  currentShouldAutoplay.value = false;
  resetHistoryPersistenceTracking(true);
}

function resetPlaybackState() {
  sourceRequestSeq += 1;
  resetSeriesState();
  resetLoadedMediaState();
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

function normalizeImportedTracks(payload) {
  return Array.isArray(payload) ? payload.filter(Boolean) : payload ? [payload] : [];
}

function hasSubtitleSelectionChanged(left, right) {
  return (
    left?.mode !== right?.mode ||
    left?.primaryLang !== right?.primaryLang ||
    left?.secondaryLang !== right?.secondaryLang
  );
}

function setSubtitleSelection(nextSelection) {
  if (typeof window === 'undefined') {
    currentSubtitleSelection.value = nextSelection;
    return;
  }

  const reconciledSelection = reconcileSubtitlePreference(nextSelection, currentSubtitleTracks.value, window.navigator);
  if (!hasSubtitleSelectionChanged(currentSubtitleSelection.value, reconciledSelection)) {
    return;
  }

  currentSubtitleSelection.value = reconciledSelection;
  persistSubtitlePreference(reconciledSelection, window);
}

function commitHistoryUrl(mode, url) {
  if (!window?.history) return;

  const method =
    mode === 'replace'
      ? originalReplaceState || window.history.replaceState
      : originalPushState || window.history.pushState;

  method.call(window.history, window.history.state, '', url);
}

function syncPlayerUrl(cid, time, mode = 'push', options = {}) {
  const { includeTime = true } = options;
  const nextUrl = new URL(window.location.href);
  const currentHref = nextUrl.toString();

  if (cid) {
    nextUrl.searchParams.set('cid', cid);
  } else {
    nextUrl.searchParams.delete('cid');
  }

  nextUrl.searchParams.delete('gateway');

  if (cid && includeTime && time > 0) {
    nextUrl.searchParams.set('t', time);
  } else {
    nextUrl.searchParams.delete('t');
  }

  if (nextUrl.toString() === currentHref) return;

  commitHistoryUrl(mode, nextUrl);
}

function applySingleSourceState(sourceCid) {
  currentSourceCid.value = sourceCid;
  currentSourceMode.value = sourceCid ? 'single' : 'idle';
  currentSeriesTitle.value = '';
  currentSeriesEpisodes.value = [];
  currentSeriesError.value = '';
  currentSeriesPlaylistLoading.value = false;
  currentEpisodeId.value = '';
  currentEpisodePath.value = '';
}

function applySeriesState(sourceCid, playlist, selectedEpisode = null, errorMessage = '') {
  currentSourceCid.value = sourceCid;
  currentSourceMode.value = errorMessage ? 'series-error' : 'series';
  currentSeriesTitle.value = playlist?.title || '';
  currentSeriesEpisodes.value = buildSeriesEpisodeDisplayList(sourceCid, playlist?.episodes);
  currentSeriesError.value = errorMessage;
  currentSeriesPlaylistLoading.value = false;
  currentEpisodeId.value = selectedEpisode?.id || '';
  currentEpisodePath.value = selectedEpisode?.path || '';
}

function buildCurrentHistoryContext() {
  if (!isSeriesMode.value) {
    return {
      seriesCid: '',
      episodeId: '',
      episodePath: '',
    };
  }

  return {
    seriesCid: currentSourceCid.value,
    episodeId: currentEpisodeId.value,
    episodePath: currentEpisodePath.value,
  };
}

function canPersistCurrentHistory(snapshot = null) {
  if (currentHistoryAllowsReadyState.value) {
    return true;
  }

  if (hasCurrentPlaybackStarted.value) {
    return true;
  }

  if (snapshot?.isPlaying === true || snapshot?.hasEnded === true) {
    hasCurrentPlaybackStarted.value = true;
    return true;
  }

  return false;
}

async function loadSourceFromCid(sourceCid, gateway, startTime = 0, options = {}) {
  const normalizedSourceCid = typeof sourceCid === 'string' ? sourceCid.trim() : '';
  if (!normalizedSourceCid) return;

  const {
    updateUrl = true,
    shouldAutoplay = false,
    preferredEpisodePath = '',
  } = options;
  const nextGateway = resolveGateway(gateway || readConfiguredGateway());
  const requestSeq = ++sourceRequestSeq;

  currentSourceCid.value = normalizedSourceCid;
  currentGateway.value = nextGateway;
  currentSeriesPlaylistLoading.value = true;
  currentSeriesError.value = '';
  persistGateway(nextGateway, window);
  status.value = '正在檢查內容入口...';

  const playlistResult = await fetchPlaylistManifest(normalizedSourceCid, nextGateway);
  if (requestSeq !== sourceRequestSeq) return;

  if (playlistResult.status === 'ok' && playlistResult.playlist) {
    const selectedEpisode = resolveSelectedPlaylistEpisode(playlistResult.playlist, preferredEpisodePath);
    if (!selectedEpisode) {
      persistCurrentHistory();
      applySeriesState(normalizedSourceCid, playlistResult.playlist, null, '這份 playlist.json 目前沒有可播放集數。');
      resetLoadedMediaState();
      status.value = '這份 playlist.json 目前沒有可播放集數。';
      if (updateUrl) {
        syncPlayerUrl(normalizedSourceCid, 0, 'push', { includeTime: false });
      }
      return;
    }

    applySeriesState(normalizedSourceCid, playlistResult.playlist, selectedEpisode);
    void hydrateSeriesPlaylistEpisodes(normalizedSourceCid, playlistResult.playlist, nextGateway, requestSeq);
    loadVideo(buildPlayableEpisodeCid(normalizedSourceCid, selectedEpisode), nextGateway, startTime, {
      updateUrl: false,
      shouldAutoplay,
      allowReadyStateHistory: false,
      sourceCid: normalizedSourceCid,
      seriesEpisode: selectedEpisode,
    });
    if (updateUrl) {
      syncPlayerUrl(normalizedSourceCid, 0, 'push', { includeTime: false });
    }
    return;
  }

  if (playlistResult.status === 'invalid') {
    persistCurrentHistory();
    applySeriesState(normalizedSourceCid, null, null, playlistResult.detail || 'playlist.json 格式不正確。');
    resetLoadedMediaState();
    status.value = currentSeriesError.value;
    if (updateUrl) {
      syncPlayerUrl(normalizedSourceCid, 0, 'push', { includeTime: false });
    }
    return;
  }

  const hasDirectVideo = await checkDirectVideoAvailability(normalizedSourceCid, nextGateway);
  if (requestSeq !== sourceRequestSeq) return;

  if (hasDirectVideo) {
    applySingleSourceState(normalizedSourceCid);
    loadVideo(normalizedSourceCid, nextGateway, startTime, {
      updateUrl: false,
      shouldAutoplay,
      allowReadyStateHistory: true,
      sourceCid: normalizedSourceCid,
    });
    if (updateUrl) {
      syncPlayerUrl(normalizedSourceCid, startTime, 'push', { includeTime: true });
    }
    return;
  }

  persistCurrentHistory();
  applySeriesState(
    normalizedSourceCid,
    null,
    null,
    playlistResult.status === 'missing'
      ? '找不到 playlist.json，也找不到單片播放入口。'
      : playlistResult.detail || '找不到可播放內容。'
  );
  resetLoadedMediaState();
  status.value = currentSeriesError.value;
  if (updateUrl) {
    syncPlayerUrl(normalizedSourceCid, 0, 'push', { includeTime: false });
  }
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
      cid !== currentSourceCid.value ||
      nextGateway !== prevGateway ||
      time !== currentStartTime.value ||
      !currentM3u8Url.value;
    if (shouldReload) {
      void loadSourceFromCid(cid, nextGateway, time, { updateUrl: false, shouldAutoplay: false });
    }
    activeView.value = 'home';
    return;
  }

  if (currentSourceCid.value || currentCid.value) {
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
  currentSubtitleSelection.value =
    typeof window === 'undefined' ? createDefaultSubtitlePreference() : readStoredSubtitlePreference(window);
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
  activeView.value = 'home';
  void loadSourceFromCid(cid, currentGateway.value, time, { updateUrl: true, shouldAutoplay: false });
}

function onGatewayChange(gateway) {
  const nextGateway = resolveGateway(gateway);
  if (currentSourceCid.value && activeView.value === 'home') {
    const snapshot = getPlaybackSnapshot(window);
    void loadSourceFromCid(currentSourceCid.value, nextGateway, snapshot.time, {
      updateUrl: true,
      shouldAutoplay: snapshot.isPlaying,
      preferredEpisodePath: currentEpisodePath.value,
    });
    return;
  }

  currentGateway.value = nextGateway;
  persistGateway(nextGateway, window);
}

function onGatewayCandidatesChange(payload = {}) {
  sidecarGatewayCandidates.value = Array.isArray(payload?.candidates)
    ? payload.candidates
        .map((candidate) => (typeof candidate?.url === 'string' ? candidate.url.trim() : ''))
        .filter((candidate) => candidate)
    : [];
}

function resolveSidecarCandidates(primaryGateway) {
  return buildSidecarGatewayCandidates(primaryGateway, sidecarGatewayCandidates.value);
}

async function hydrateSeriesPlaylistEpisodes(sourceCid, playlist, gateway, requestSeq) {
  const episodes = Array.isArray(playlist?.episodes) ? playlist.episodes : [];
  if (episodes.length === 0) {
    return;
  }

  const sidecarCandidates = resolveSidecarCandidates(gateway);
  episodes.forEach((episode) => {
    void hydrateSeriesPlaylistEpisode(sourceCid, episode, gateway, sidecarCandidates, requestSeq);
  });
}

async function hydrateSeriesPlaylistEpisode(sourceCid, episode, gateway, sidecarCandidates, requestSeq) {
  const episodeCid = buildPlayableEpisodeCid(sourceCid, episode);
  if (!episodeCid) {
    return;
  }

  const [posterUrl, videoInfo] = await Promise.all([
    loadPosterUrlWithFallback(episodeCid, gateway, sidecarCandidates),
    loadVideoInfoWithFallback(episodeCid, gateway, sidecarCandidates),
  ]);

  if (
    requestSeq !== sourceRequestSeq ||
    currentSourceCid.value !== sourceCid ||
    !['series', 'series-error'].includes(currentSourceMode.value)
  ) {
    return;
  }

  patchSeriesEpisodeDisplayState(sourceCid, episode.path, {
    displayTitle: videoInfo?.title,
    displayUploader: videoInfo?.uploader,
    durationString: videoInfo?.durationString,
    posterUrl,
  });
}

function loadVideo(cid, gateway, startTime = 0, options = {}) {
  const {
    updateUrl = true,
    shouldAutoplay = false,
    allowReadyStateHistory = true,
    sourceCid = cid,
    seriesEpisode = null,
  } = options;
  const nextGateway = resolveGateway(gateway || readConfiguredGateway());
  const requestSeq = ++metadataRequestSeq;
  const nextIpfsBaseUrl = `${nextGateway}${cid}/`;
  const nextM3u8Url = `${nextGateway}${cid}/index.m3u8`;
  const historyPosterUrl = `${nextGateway}${cid}/${posterAssetFileName}`;
  const cachedPosterUrl = readCachedSidecarObjectUrl(cid, posterAssetFileName);
  const cachedAvatarUrl = readCachedSidecarObjectUrl(cid, avatarAssetFileName);
  const cachedVideoInfo = readCachedVideoInfo(cid);
  const cachedSubtitleCatalog = readCachedSubtitleCatalog(cid, nextGateway, sidecarGatewayCandidates.value);
  const seededSeriesVideoInfo = seriesEpisode ? buildSeriesEpisodeVideoInfo(cachedVideoInfo, seriesEpisode) : null;

  persistCurrentHistory();
  const shouldClearImportedSubtitles = currentCid.value && currentCid.value !== cid;
  currentCid.value = cid;
  currentSourceCid.value = sourceCid;
  currentGateway.value = nextGateway;
  currentLoadSequence.value += 1;
  persistGateway(nextGateway, window);
  status.value = '正在連線至網關...';

  if (seriesEpisode) {
    currentSourceMode.value = 'series';
    currentSeriesError.value = '';
    currentSeriesPlaylistLoading.value = false;
    currentEpisodeId.value = seriesEpisode.id;
    currentEpisodePath.value = seriesEpisode.path;
  } else {
    applySingleSourceState(sourceCid);
  }

  currentIpfsBaseUrl.value = nextIpfsBaseUrl;
  currentM3u8Url.value = nextM3u8Url;
  currentPosterUrl.value = cachedPosterUrl || seriesEpisode?.posterUrl || '';
  currentHistoryPosterUrl.value = historyPosterUrl;
  currentAvatarUrl.value = cachedAvatarUrl;
  currentVideoInfo.value = seededSeriesVideoInfo || cachedVideoInfo || createDefaultVideoInfo();
  if (shouldClearImportedSubtitles) {
    clearImportedSubtitles();
  }
  currentRemoteSubtitleTracks.value = cachedSubtitleCatalog?.tracks || [];
  currentRemoteSubtitleStatus.value = cachedSubtitleCatalog?.status || subtitleCatalogStatus.loading;
  currentStartTime.value = startTime;
  currentShouldAutoplay.value = shouldAutoplay;
  resetHistoryPersistenceTracking(allowReadyStateHistory);

  if (allowReadyStateHistory) {
    persistHistoryEntry({
      cid,
      ...buildCurrentHistoryContext(),
      posterUrl: historyPosterUrl,
      gateway: nextGateway,
      progressSeconds: startTime,
      lastWatchedAt: Date.now(),
    });
  }

  void loadSidecarAssets(cid, nextGateway, requestSeq, {
    sourceCid,
    seriesEpisode,
  });

  if (updateUrl) {
    syncPlayerUrl(sourceCid, startTime, 'push', { includeTime: !seriesEpisode });
  }
}

function selectSeriesEpisode(episode) {
  if (!episode?.playable || !currentSourceCid.value) {
    return;
  }

  if (episode.id === currentEpisodeId.value && episode.path === currentEpisodePath.value) {
    return;
  }

  applySeriesState(
    currentSourceCid.value,
    {
      title: currentSeriesTitle.value,
      episodes: currentSeriesEpisodes.value,
    },
    episode
  );
  loadVideo(buildPlayableEpisodeCid(currentSourceCid.value, episode), currentGateway.value, 0, {
    updateUrl: false,
    shouldAutoplay: false,
    allowReadyStateHistory: false,
    sourceCid: currentSourceCid.value,
    seriesEpisode: episode,
  });
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
    allowReadyStateHistory: currentSourceMode.value === 'single',
    sourceCid: currentSourceCid.value || cid,
    seriesEpisode: currentSelectedSeriesEpisode.value,
  });
}

function onSubtitleImport(importedTrack) {
  const importedTracks = normalizeImportedTracks(importedTrack);
  if (importedTracks.length === 0) {
    return;
  }

  importedTracks.forEach((track) => {
    replaceImportedSubtitle(track);
  });

  if (currentSubtitleSelection.value.mode === 'showing' && currentSubtitleSelection.value.primaryLang) {
    return;
  }

  const defaultImportedTrack = importedTracks[0];
  setSubtitleSelection({
    mode: 'showing',
    primaryLang: defaultImportedTrack.lang,
    secondaryLang:
      normalizeLocale(currentSubtitleSelection.value.secondaryLang) === normalizeLocale(defaultImportedTrack.lang)
        ? ''
        : currentSubtitleSelection.value.secondaryLang,
  });
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

function onSubtitleSelectionChange(nextSelection) {
  if (!nextSelection) {
    return;
  }

  setSubtitleSelection(nextSelection);
}

async function loadSidecarAssets(cid, gateway, requestSeq, options = {}) {
  const { sourceCid = '', seriesEpisode = null } = options;
  const sidecarCandidates = resolveSidecarCandidates(gateway);
  const [nextPosterUrl, nextAvatarUrl, nextVideoInfo, subtitleCatalog] = await Promise.all([
    loadPosterUrlWithFallback(cid, gateway, sidecarCandidates),
    loadAvatarUrlWithFallback(cid, gateway, sidecarCandidates),
    loadVideoInfoWithFallback(cid, gateway, sidecarCandidates),
    loadSubtitleCatalogWithFallback(cid, gateway, sidecarCandidates),
  ]);

  if (requestSeq !== metadataRequestSeq) return;

  currentPosterUrl.value = nextPosterUrl || currentPosterUrl.value;
  currentAvatarUrl.value = nextAvatarUrl || '';
  currentVideoInfo.value = seriesEpisode ? buildSeriesEpisodeVideoInfo(nextVideoInfo, seriesEpisode) : nextVideoInfo;
  currentRemoteSubtitleStatus.value = subtitleCatalog.status;
  currentRemoteSubtitleTracks.value = subtitleCatalog.tracks;

  if (sourceCid && seriesEpisode?.path) {
    patchSeriesEpisodeDisplayState(sourceCid, seriesEpisode.path, {
      displayTitle: nextVideoInfo?.title,
      displayUploader: nextVideoInfo?.uploader,
      durationString: nextVideoInfo?.durationString,
      posterUrl: nextPosterUrl,
    });
  }

  const snapshot = activeView.value === 'home' ? getPlaybackSnapshot(window) : null;
  persistCurrentHistory({ snapshot });
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
  if (!canPersistCurrentHistory(currentSnapshot)) {
    return;
  }

  const progressSeconds =
    currentSnapshot.hasEnded && currentSnapshot.duration > 0 ? currentSnapshot.duration : currentSnapshot.time;

  persistHistoryEntry({
    cid,
    ...buildCurrentHistoryContext(),
    title: currentVideoInfo.value.title,
    uploader: currentVideoInfo.value.uploader,
    posterUrl: currentHistoryPosterUrl.value,
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

  if (activeView.value === 'history' && currentSourceCid.value) {
    const currentHistoryEntry = findHistoryEntry(currentCid.value);
    const resumeTime =
      Number.isFinite(currentHistoryEntry?.progressSeconds) && currentHistoryEntry.progressSeconds > 0
        ? currentHistoryEntry.progressSeconds
        : currentStartTime.value;

    void loadSourceFromCid(currentSourceCid.value, currentGateway.value, resumeTime, {
      updateUrl: false,
      shouldAutoplay: false,
      preferredEpisodePath: currentHistoryEntry?.episodePath || currentEpisodePath.value,
    });
  }

  activeView.value = 'home';
  closeSidebar();
}

function onHistorySelect(item) {
  if (!item?.cid) return;

  if (item.seriesCid && item.episodePath) {
    void loadSourceFromCid(item.seriesCid, currentGateway.value, item.progressSeconds || 0, {
      updateUrl: true,
      shouldAutoplay: false,
      preferredEpisodePath: item.episodePath,
    });
  } else {
    void loadSourceFromCid(item.cid, currentGateway.value, item.progressSeconds || 0, {
      updateUrl: true,
      shouldAutoplay: false,
    });
  }
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

watch(
  currentSubtitleTracks,
  (nextTracks) => {
    if (typeof window === 'undefined') {
      return;
    }

    const reconciledSelection = reconcileSubtitlePreference(currentSubtitleSelection.value, nextTracks, window.navigator);
    if (!hasSubtitleSelectionChanged(currentSubtitleSelection.value, reconciledSelection)) {
      return;
    }

    currentSubtitleSelection.value = reconciledSelection;
    persistSubtitlePreference(reconciledSelection, window);
  },
  { deep: true }
);
</script>

<template>
  <Header
    @search="onSearchCid"
    :current-gateway="currentGateway"
    :current-cid="currentCid"
    :current-load-sequence="currentLoadSequence"
    :current-video-info="currentVideoInfo"
    :sidebar-open="isSidebarOpen"
    @gateway-change="onGatewayChange"
    @gateway-candidates-change="onGatewayCandidatesChange"
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
          :avatar-url="currentAvatarUrl"
          :subtitles="currentSubtitleTracks"
          :subtitle-selection="currentSubtitleSelection"
          :remote-subtitle-status="currentRemoteSubtitleStatus"
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
          @subtitle-selection-change="onSubtitleSelectionChange"
        />
        <SeriesPlaylistPage
          v-if="shouldShowSeriesPlaylist"
          :title="currentSeriesTitle"
          :episodes="currentSeriesEpisodes"
          :selected-episode-id="currentEpisodeId"
          :selected-episode-path="currentEpisodePath"
          :loading="currentSeriesPlaylistLoading"
          :error-message="currentSeriesError"
          @select="selectSeriesEpisode"
        />
        <RecommendationsPage v-else />
      </template>
    </main>
  </div>
</template>

<style src="./App.css"></style>
