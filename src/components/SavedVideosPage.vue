<script setup>
import { computed } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['select', 'remove']);

const previewItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    displayTitle: item.title || formatFallbackTitle(item.cid),
    displayUploader: item.uploader || 'IPFS Node',
    savedAtLabel: formatSavedAt(item.savedAt),
    gatewayLabel: formatGatewayLabel(item.gateway),
  }))
);

function handleSelect(item) {
  emit('select', item);
}

function handleRemove(cid) {
  emit('remove', cid);
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

function formatSavedAt(value) {
  const timestamp = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '剛剛儲存';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return '剛剛儲存';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} 分鐘前儲存`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} 小時前儲存`;
  return `${Math.floor(diffMs / dayMs)} 天前儲存`;
}
</script>

<template>
  <section class="saved-page" data-testid="saved-page">
    <div class="saved-header">
      <div class="saved-copy">
        <h2>已儲存影片</h2>
        <p class="subtitle">你手動儲存的影片會保留在本機列表，不會被後續觀看歷史自動洗掉。</p>
      </div>
    </div>

    <div v-if="previewItems.length === 0" class="saved-empty glass-panel" data-testid="saved-empty">
      <p class="saved-empty-title">還沒有已儲存影片</p>
      <p class="saved-empty-text">先在觀看頁按下儲存，這裡就會出現你想稍後回看的內容。</p>
    </div>

    <div v-else class="saved-list" data-testid="saved-list">
      <article
        v-for="item in previewItems"
        :key="item.cid"
        class="saved-item glass-panel"
        :data-testid="`saved-item-${item.cid}`"
      >
        <button type="button" class="saved-item-main" @click="handleSelect(item)">
          <div class="saved-thumb">
            <img v-if="item.posterUrl" :src="item.posterUrl" :alt="item.displayTitle" />
            <div v-else class="saved-thumb-fallback">{{ item.displayTitle.slice(0, 1) }}</div>
            <div v-if="item.durationString" class="saved-duration">{{ item.durationString }}</div>
          </div>

          <div class="saved-body">
            <div class="saved-state-row">
              <span class="saved-status-badge">已儲存</span>
              <span class="saved-open-label">開啟影片</span>
            </div>
            <h3 class="saved-title">{{ item.displayTitle }}</h3>
            <p class="saved-uploader">{{ item.displayUploader }}</p>
            <p class="saved-time">{{ item.savedAtLabel }}</p>
            <div class="saved-meta">
              <span>{{ item.gatewayLabel }}</span>
            </div>
          </div>
        </button>

        <button type="button" class="saved-remove" @click="handleRemove(item.cid)">移除</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.saved-page {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 0 0 16px;
  padding: 12px 16px 24px 0;
}

.saved-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.saved-copy h2 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  line-height: 1.55;
  max-width: 720px;
}

.saved-empty {
  padding: 28px;
  border-radius: 18px;
  display: grid;
  gap: 10px;
}

.saved-empty-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.saved-empty-text {
  color: var(--text-secondary);
  max-width: 48ch;
  line-height: 1.6;
}

.saved-list {
  display: grid;
  gap: 12px;
}

.saved-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border-radius: 20px;
}

.saved-item-main {
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

.saved-thumb {
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

.saved-thumb img,
.saved-thumb-fallback {
  width: 100%;
  height: 100%;
}

.saved-thumb img {
  object-fit: cover;
  display: block;
}

.saved-thumb-fallback {
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.82);
}

.saved-duration {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  font-size: 0.78rem;
}

.saved-body {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 8px;
}

.saved-state-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.saved-status-badge,
.saved-open-label {
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

.saved-status-badge {
  border: 1px solid rgba(255, 213, 89, 0.28);
  background: rgba(255, 213, 89, 0.12);
  color: #ffd976;
}

.saved-open-label {
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.saved-title {
  font-size: 1.08rem;
  line-height: 1.35;
}

.saved-uploader,
.saved-time {
  color: var(--text-secondary);
}

.saved-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.65);
}

.saved-remove {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.saved-remove:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

@media (max-width: 1024px) {
  .saved-item {
    grid-template-columns: 1fr;
  }

  .saved-remove {
    justify-self: flex-start;
  }
}

@media (max-width: 768px) {
  .saved-page {
    margin-left: 0;
    padding: 12px 16px 24px;
  }

  .saved-header,
  .saved-item-main {
    flex-direction: column;
  }

  .saved-thumb {
    width: 100%;
  }

  .saved-state-row {
    flex-wrap: wrap;
  }
}
</style>
