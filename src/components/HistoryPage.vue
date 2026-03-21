<script setup>
import { computed } from 'vue';
import { formatTime } from '../utils/time';

const HISTORY_COMPLETED_MIN_PERCENT = 95;
const HISTORY_COMPLETED_MAX_REMAINING_SECONDS = 5;

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['select', 'remove', 'clear']);

const previewItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    displayTitle: item.title || formatFallbackTitle(item.cid),
    displayUploader: item.uploader || 'IPFS Node',
    lastWatchedLabel: formatLastWatched(item.lastWatchedAt),
    gatewayLabel: formatGatewayLabel(item.gateway),
    progressPercent: getProgressPercent(item),
    playbackState: getPlaybackState(item),
  }))
);

function handleSelect(item) {
  emit('select', item);
}

function handleRemove(cid) {
  emit('remove', cid);
}

function handleClear() {
  emit('clear');
}

function formatFallbackTitle(cid) {
  if (!cid) return 'Unknown CID';
  if (cid.length <= 16) return cid;
  return `${cid.slice(0, 8)}...${cid.slice(-6)}`;
}

function formatGatewayLabel(gateway) {
  if (!gateway) return 'Gateway 未記錄';

  try {
    const parsed = new URL(gateway);
    return parsed.hostname || parsed.host || gateway;
  } catch (_) {
    return gateway;
  }
}

function formatLastWatched(value) {
  const timestamp = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '剛剛';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return '剛剛';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} 分鐘前`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} 小時前`;
  return `${Math.floor(diffMs / dayMs)} 天前`;
}

function parseDurationString(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return 0;

  const parts = normalized.split(':').map((part) => Number.parseInt(part, 10));
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return 0;
  }

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }

  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  return 0;
}

function getDurationSeconds(item) {
  return Number.isFinite(item.durationSeconds) && item.durationSeconds > 0
    ? item.durationSeconds
    : parseDurationString(item.durationString);
}

function getProgressPercent(item) {
  const durationSeconds = getDurationSeconds(item);
  if (!durationSeconds || !item.progressSeconds) return 0;

  return Math.max(0, Math.min(100, Math.round((item.progressSeconds / durationSeconds) * 100)));
}

function getPlaybackState(item) {
  const progressSeconds = Number.isFinite(item.progressSeconds) && item.progressSeconds > 0 ? item.progressSeconds : 0;
  const durationSeconds = getDurationSeconds(item);
  const progressPercent = getProgressPercent(item);
  const remainingSeconds = durationSeconds > 0 ? Math.max(0, durationSeconds - progressSeconds) : Number.POSITIVE_INFINITY;

  if (
    durationSeconds > 0 &&
    progressSeconds > 0 &&
    (progressPercent >= HISTORY_COMPLETED_MIN_PERCENT || remainingSeconds <= HISTORY_COMPLETED_MAX_REMAINING_SECONDS)
  ) {
    return {
      id: 'completed',
      statusLabel: '已看完',
      progressLabel: '已播放完成，可以重新播放',
      actionLabel: '重新播放',
    };
  }

  if (progressSeconds > 0) {
    return {
      id: 'resume',
      statusLabel: '繼續觀看',
      progressLabel: `從 ${formatTime(progressSeconds)} 繼續觀看`,
      actionLabel: '繼續播放',
    };
  }

  return {
    id: 'new',
    statusLabel: '尚未開始',
    progressLabel: '尚未開始播放',
    actionLabel: '立即播放',
  };
}
</script>

<template>
  <section class="history-page" data-testid="history-page">
    <div class="history-header">
      <div class="history-copy">
        <h2>觀看歷史</h2>
        <p class="subtitle">觀看歷史只記錄在本機，方便你下次接著看，不會同步到其他裝置。</p>
      </div>
      <button
        v-if="previewItems.length > 0"
        type="button"
        class="history-clear glass-panel"
        data-testid="history-clear-all"
        @click="handleClear"
      >
        清空全部
      </button>
    </div>

    <div v-if="previewItems.length === 0" class="history-empty glass-panel" data-testid="history-empty">
      <p class="history-empty-title">還沒有觀看紀錄</p>
      <p class="history-empty-text">先載入一支影片，這裡就會出現你最近看過的內容與續播進度。</p>
    </div>

    <div v-else class="history-list" data-testid="history-list">
      <article
        v-for="item in previewItems"
        :key="item.cid"
        class="history-item glass-panel"
        :class="`is-${item.playbackState.id}`"
        :data-testid="`history-item-${item.cid}`"
      >
        <button type="button" class="history-item-main" @click="handleSelect(item)">
          <div class="history-thumb">
            <img v-if="item.posterUrl" :src="item.posterUrl" :alt="item.displayTitle" />
            <div v-else class="history-thumb-fallback">{{ item.displayTitle.slice(0, 1) }}</div>
            <div v-if="item.durationString" class="history-duration">{{ item.durationString }}</div>
            <div class="history-progress-bar">
              <span :style="{ width: `${item.progressPercent}%` }"></span>
            </div>
          </div>

          <div class="history-body">
            <div class="history-state-row">
              <span class="history-status-badge" :class="`is-${item.playbackState.id}`">
                {{ item.playbackState.statusLabel }}
              </span>
              <span class="history-open-label">{{ item.playbackState.actionLabel }}</span>
            </div>
            <h3 class="history-title">{{ item.displayTitle }}</h3>
            <p class="history-uploader">{{ item.displayUploader }}</p>
            <p class="history-progress" :class="`is-${item.playbackState.id}`">{{ item.playbackState.progressLabel }}</p>
            <div class="history-meta">
              <span>{{ item.lastWatchedLabel }}</span>
              <span>{{ item.gatewayLabel }}</span>
            </div>
          </div>
        </button>

        <button type="button" class="history-remove" @click="handleRemove(item.cid)">移除</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.history-page {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 0 0 16px;
  padding: 12px 16px 24px 0;
}

.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.history-copy h2 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  line-height: 1.55;
  max-width: 720px;
}

.history-clear {
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  background: transparent;
  border-radius: 999px;
  padding: 12px 18px;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.history-clear:hover {
  transform: translateY(-1px);
  border-color: rgba(0, 210, 255, 0.35);
}

.history-empty {
  padding: 28px;
  border-radius: 18px;
  display: grid;
  gap: 10px;
}

.history-empty-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.history-empty-text {
  color: var(--text-secondary);
  max-width: 48ch;
  line-height: 1.6;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border-radius: 20px;
}

.history-item-main {
  display: flex;
  align-items: stretch;
  gap: 16px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  min-width: 0;
  text-align: left;
}

.history-thumb {
  position: relative;
  width: 220px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 16px;
  background:
    radial-gradient(circle at top left, rgba(0, 210, 255, 0.22), transparent 38%),
    linear-gradient(135deg, rgba(8, 10, 18, 0.95), rgba(28, 31, 52, 0.9));
  flex-shrink: 0;
}

.history-thumb img,
.history-thumb-fallback {
  width: 100%;
  height: 100%;
}

.history-thumb img {
  object-fit: cover;
  display: block;
}

.history-thumb-fallback {
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.82);
}

.history-duration {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  font-size: 0.78rem;
}

.history-progress-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.history-progress-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-neon));
}

.history-item.is-completed .history-progress-bar span {
  background: linear-gradient(90deg, #7ef0c0, #2bd97f);
}

.history-body {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 8px;
}

.history-state-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-status-badge,
.history-open-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  min-height: 30px;
  padding: 6px 11px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.history-status-badge {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
}

.history-status-badge.is-resume {
  border-color: rgba(0, 210, 255, 0.28);
  background: rgba(0, 210, 255, 0.12);
  color: #8feaff;
}

.history-status-badge.is-completed {
  border-color: rgba(43, 217, 127, 0.3);
  background: rgba(43, 217, 127, 0.12);
  color: #92f0bc;
}

.history-status-badge.is-new {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.history-open-label {
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.history-title {
  font-size: 1.08rem;
  line-height: 1.35;
}

.history-uploader,
.history-progress {
  color: var(--text-secondary);
}

.history-progress.is-resume {
  color: #b9f3ff;
}

.history-progress.is-completed {
  color: #a2efc3;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.65);
}

.history-remove {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.history-remove:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

@media (max-width: 1024px) {
  .history-item {
    grid-template-columns: 1fr;
  }

  .history-remove {
    justify-self: flex-start;
  }
}

@media (max-width: 768px) {
  .history-page {
    margin-left: 0;
    padding: 12px 16px 24px;
  }

  .history-header,
  .history-item-main {
    flex-direction: column;
  }

  .history-thumb {
    width: 100%;
  }

  .history-clear {
    width: 100%;
  }

  .history-state-row {
    flex-wrap: wrap;
  }
}
</style>
