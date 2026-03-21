<script setup>
import VideoPlayer from './VideoPlayer.vue';
import VideoInfo from './VideoInfo.vue';
import { createDefaultVideoInfo } from '../utils/videoInfo';

defineProps({
  cid: {
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
  subtitles: {
    type: Array,
    default: () => [],
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
  videoInfo: {
    type: Object,
    default: () => createDefaultVideoInfo(),
  },
});

const emit = defineEmits(['status-update', 'levels-loaded', 'playback-snapshot', 'subtitle-import', 'subtitle-remove']);

function handleStatusUpdate(nextStatus) {
  emit('status-update', nextStatus);
}

function handleLevelsLoaded(levels) {
  emit('levels-loaded', levels);
}

function handlePlaybackSnapshot(snapshot) {
  emit('playback-snapshot', snapshot);
}

function handleSubtitleImport(importedTrack) {
  emit('subtitle-import', importedTrack);
}

function handleSubtitleRemove(trackId) {
  emit('subtitle-remove', trackId);
}
</script>

<template>
  <section class="watch-page" data-testid="watch-page">
    <VideoPlayer
      class="player-container glass-panel"
      data-testid="player-container"
      :m3u8-url="m3u8Url"
      :poster-url="posterUrl"
      :subtitles="subtitles"
      :start-time="startTime"
      :should-autoplay="shouldAutoplay"
      @status-update="handleStatusUpdate"
      @levels-loaded="handleLevelsLoaded"
      @playback-snapshot="handlePlaybackSnapshot"
    />
    <h1 v-if="videoInfo.title" class="player-title">{{ videoInfo.title }}</h1>
    <VideoInfo
      :cid="cid"
      :ipfs-base-url="ipfsBaseUrl"
      :video-info="videoInfo"
      :remote-subtitles="remoteSubtitles"
      :imported-subtitles="importedSubtitles"
      @subtitle-import="handleSubtitleImport"
      @subtitle-remove="handleSubtitleRemove"
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
