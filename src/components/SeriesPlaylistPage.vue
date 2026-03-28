<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n';

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  episodes: {
    type: Array,
    default: () => [],
  },
  selectedEpisodeId: {
    type: String,
    default: '',
  },
  selectedEpisodePath: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['select']);
const { t } = useI18n();

const displayTitle = computed(() => props.title || t('seriesPlaylist.title'));
const hasEpisodes = computed(() => props.episodes.length > 0);
const showEmptyState = computed(() => !props.loading && !props.errorMessage && !hasEpisodes.value);

function isSelectedEpisode(episode) {
  if (props.selectedEpisodeId && episode?.id) {
    return props.selectedEpisodeId === episode.id;
  }

  return props.selectedEpisodePath && episode?.path ? props.selectedEpisodePath === episode.path : false;
}

function formatEpisodeNumber(episode) {
  const numeric = Number(episode?.number);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'EP';
  }

  return `EP ${String(numeric).padStart(2, '0')}`;
}

function resolveEpisodeTitle(episode) {
  return episode?.displayTitle || episode?.title || formatEpisodeNumber(episode);
}

function resolveEpisodeUploader(episode) {
  return episode?.displayUploader || '';
}

function resolveEpisodeDuration(episode) {
  return episode?.durationString || '';
}

function handleEpisodeSelect(episode) {
  if (!episode?.playable) {
    return;
  }

  emit('select', episode);
}
</script>

<template>
  <section class="series-playlist-page" data-testid="series-playlist-page">
    <div class="series-playlist-header">
      <p class="series-playlist-eyebrow">{{ t('seriesPlaylist.title') }}</p>
      <h2 class="series-playlist-title" data-testid="series-playlist-title">{{ displayTitle }}</h2>
    </div>

    <p v-if="loading" class="series-playlist-state" data-testid="series-playlist-loading">
      {{ t('seriesPlaylist.loading') }}
    </p>

    <p v-else-if="errorMessage" class="series-playlist-state is-error" data-testid="series-playlist-error">
      {{ errorMessage }}
    </p>

    <p v-else-if="showEmptyState" class="series-playlist-state" data-testid="series-playlist-empty">
      {{ t('seriesPlaylist.empty') }}
    </p>

    <div v-if="hasEpisodes" class="series-playlist-list" data-testid="series-playlist-list">
      <button
        v-for="episode in episodes"
        :key="episode.id || episode.path"
        type="button"
        class="series-playlist-item"
        :class="{
          'is-selected': isSelectedEpisode(episode),
          'is-disabled': !episode.playable,
        }"
        :disabled="!episode.playable"
        :data-testid="`series-playlist-item-${episode.id}`"
        @click="handleEpisodeSelect(episode)"
      >
        <div class="series-playlist-item-poster-frame" :class="{ 'is-empty': !episode.posterUrl }">
          <img
            v-if="episode.posterUrl"
            :src="episode.posterUrl"
            :alt="resolveEpisodeTitle(episode)"
            class="series-playlist-item-poster"
            :data-testid="`series-playlist-poster-${episode.id}`"
          />
          <span v-else class="series-playlist-item-poster-fallback">
            {{ formatEpisodeNumber(episode) }}
          </span>
          <span
            v-if="resolveEpisodeDuration(episode)"
            class="series-playlist-item-duration"
            :data-testid="`series-playlist-duration-${episode.id}`"
          >
            {{ resolveEpisodeDuration(episode) }}
          </span>
        </div>
        <div class="series-playlist-item-copy">
          <p class="series-playlist-item-title">{{ resolveEpisodeTitle(episode) }}</p>
          <p v-if="resolveEpisodeUploader(episode)" class="series-playlist-item-uploader">
            {{ resolveEpisodeUploader(episode) }}
          </p>
          <p v-else class="series-playlist-item-uploader is-empty">
            {{ formatEpisodeNumber(episode) }}
          </p>
          <span
            v-if="isSelectedEpisode(episode)"
            class="series-playlist-item-badge"
            data-testid="series-playlist-selected-badge"
          >
            {{ t('seriesPlaylist.selected') }}
          </span>
          <span v-else-if="!episode.playable" class="series-playlist-item-badge is-disabled">
            {{ t('seriesPlaylist.unavailable') }}
          </span>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.series-playlist-page {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
  margin: 0 0 0 16px;
  padding: 12px 16px 0 0;
}

.series-playlist-page > * {
  width: 100%;
  margin: 0;
}

@media (min-width: 1024px) {
  .series-playlist-page {
    flex: 0 0 380px;
  }
}

.series-playlist-header {
  display: grid;
  gap: 6px;
}

.series-playlist-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(0, 210, 255, 0.82);
}

.series-playlist-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
}

.series-playlist-state {
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
  background: rgba(10, 16, 30, 0.42);
}

.series-playlist-state.is-error {
  color: #ffd1d1;
  border-color: rgba(255, 113, 113, 0.35);
  background: rgba(68, 18, 24, 0.35);
}

.series-playlist-list {
  display: grid;
  gap: 2px;
}

.series-playlist-item {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  border: 0;
  border-radius: 12px;
  background: transparent;
  box-shadow: none;
  padding: 8px 6px;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.series-playlist-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.series-playlist-item:disabled {
  cursor: not-allowed;
}

.series-playlist-item.is-selected {
  background: rgba(255, 255, 255, 0.08);
}

.series-playlist-item.is-disabled {
  opacity: 0.56;
}

.series-playlist-item-poster-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(0, 210, 255, 0.18), transparent 55%),
    linear-gradient(180deg, rgba(21, 29, 48, 0.95), rgba(10, 16, 28, 0.9));
}

.series-playlist-item-poster-frame.is-empty {
  outline: 1px dashed rgba(255, 255, 255, 0.18);
  outline-offset: -1px;
}

.series-playlist-item-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.series-playlist-item-poster-fallback {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.7);
}

.series-playlist-item-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.78);
}

.series-playlist-item-copy {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
}

.series-playlist-item-badge {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 18px;
  padding: 0;
  border-radius: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(61, 197, 255, 0.96);
  background: transparent;
}

.series-playlist-item-badge.is-disabled {
  color: rgba(255, 214, 168, 0.98);
}

.series-playlist-item-title {
  font-size: 0.94rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.series-playlist-item-uploader {
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text-secondary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.series-playlist-item-uploader.is-empty {
  opacity: 0.76;
}

@media (max-width: 1024px) {
  .series-playlist-page {
    margin: 0 0 0 16px;
    padding: 12px 16px 24px 0;
  }

  .series-playlist-item {
    grid-template-columns: 104px minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .series-playlist-item {
    grid-template-columns: 1fr;
  }
}
</style>
