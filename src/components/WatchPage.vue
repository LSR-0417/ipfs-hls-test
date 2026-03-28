<script setup>
import VideoPlayer from './VideoPlayer.vue';
import VideoInfo from './VideoInfo.vue';
import { createDefaultVideoInfo } from '../utils/videoInfo';

defineProps({
  cid: {
    type: String,
    default: '',
  },
  gateway: {
    type: String,
    default: '',
  },
  ipfsBaseUrl: {
    type: String,
    default: '',
  },
  m3u8Url: {
    type: String,
    default: '',
  },
  posterUrl: {
    type: String,
    default: '',
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  subtitles: {
    type: Array,
    default: () => [],
  },
  subtitleSelection: {
    type: Object,
    default: () => ({
      mode: 'off',
      primaryLang: '',
      secondaryLang: '',
    }),
  },
  remoteSubtitleStatus: {
    type: String,
    default: 'idle',
  },
  remoteSubtitles: {
    type: Array,
    default: () => [],
  },
  importedSubtitles: {
    type: Array,
    default: () => [],
  },
  startTime: {
    type: Number,
    default: 0,
  },
  shouldAutoplay: {
    type: Boolean,
    default: false,
  },
  isSaved: {
    type: Boolean,
    default: false,
  },
  videoInfo: {
    type: Object,
    default: () => createDefaultVideoInfo(),
  },
});

const emit = defineEmits([
  'status-update',
  'gateway-fallback-request',
  'levels-loaded',
  'playback-snapshot',
  'save-current-video',
  'subtitle-import',
  'subtitle-remove',
  'subtitle-selection-change',
]);

function handleStatusUpdate(nextStatus) {
  emit('status-update', nextStatus);
}

function handleGatewayFallbackRequest(payload) {
  emit('gateway-fallback-request', payload);
}

function handleLevelsLoaded(levels) {
  emit('levels-loaded', levels);
}

function handlePlaybackSnapshot(snapshot) {
  emit('playback-snapshot', snapshot);
}

function handleSaveCurrentVideo() {
  emit('save-current-video');
}

function handleSubtitleImport(importedTrack) {
  emit('subtitle-import', importedTrack);
}

function handleSubtitleRemove(trackId) {
  emit('subtitle-remove', trackId);
}

function handleSubtitleSelectionChange(nextSelection) {
  emit('subtitle-selection-change', nextSelection);
}
</script>

<template>
  <section class="watch-page" data-testid="watch-page">
    <VideoPlayer
      class="player-container glass-panel"
      data-testid="player-container"
      :cid="cid"
      :gateway="gateway"
      :m3u8-url="m3u8Url"
      :poster-url="posterUrl"
      :subtitles="subtitles"
      :subtitle-selection="subtitleSelection"
      :subtitle-catalog-status="remoteSubtitleStatus"
      :frame-rate="videoInfo.fps"
      :start-time="startTime"
      :should-autoplay="shouldAutoplay"
      @status-update="handleStatusUpdate"
      @gateway-fallback-request="handleGatewayFallbackRequest"
      @levels-loaded="handleLevelsLoaded"
      @playback-snapshot="handlePlaybackSnapshot"
      @subtitle-selection-change="handleSubtitleSelectionChange"
    />
    <h1 v-if="videoInfo.title" class="player-title">{{ videoInfo.title }}</h1>
    <VideoInfo
      :cid="cid"
      :avatar-url="avatarUrl"
      :ipfs-base-url="ipfsBaseUrl"
      :is-saved="isSaved"
      :subtitles="subtitles"
      :subtitle-selection="subtitleSelection"
      :remote-subtitle-status="remoteSubtitleStatus"
      :video-info="videoInfo"
      :remote-subtitles="remoteSubtitles"
      :imported-subtitles="importedSubtitles"
      @save-current-video="handleSaveCurrentVideo"
      @subtitle-import="handleSubtitleImport"
      @subtitle-remove="handleSubtitleRemove"
      @subtitle-selection-change="handleSubtitleSelectionChange"
    />
  </section>
</template>

<style scoped>
.watch-page {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
  margin: 0 0 0 16px;
  padding: 12px 16px 0 0;
}

.watch-page > * {
  width: 100%;
  margin: 0;
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

.player-container :deep(.video-js) {
  width: 100%;
  height: 100%;
}

.player-title {
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.35;
  padding: 0;
}
</style>
