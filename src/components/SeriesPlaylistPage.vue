<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n';
import SidebarVideoListItem from './SidebarVideoListItem.vue';

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

function resolveEpisodeSecondaryText(episode) {
  return resolveEpisodeUploader(episode) || formatEpisodeNumber(episode);
}

function resolveEpisodeBadgeText(episode) {
  if (isSelectedEpisode(episode)) {
    return t('seriesPlaylist.selected');
  }

  return episode?.playable ? '' : t('seriesPlaylist.unavailable');
}

function resolveEpisodeBadgeTone(episode) {
  return isSelectedEpisode(episode) ? 'accent' : 'warning';
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
      <SidebarVideoListItem
        v-for="episode in episodes"
        :key="episode.id || episode.path"
        tag="button"
        class="series-playlist-item"
        :selected="isSelectedEpisode(episode)"
        :disabled="!episode.playable"
        :data-testid="`series-playlist-item-${episode.id}`"
        :thumbnail="episode.posterUrl"
        :poster-fallback="formatEpisodeNumber(episode)"
        :title="resolveEpisodeTitle(episode)"
        :secondary-text="resolveEpisodeSecondaryText(episode)"
        :tertiary-text="resolveEpisodeBadgeText(episode)"
        tertiary-variant="badge"
        :badge-tone="resolveEpisodeBadgeTone(episode)"
        :duration="resolveEpisodeDuration(episode)"
        :poster-test-id="`series-playlist-poster-${episode.id}`"
        :duration-test-id="`series-playlist-duration-${episode.id}`"
        :tertiary-test-id="isSelectedEpisode(episode) ? 'series-playlist-selected-badge' : ''"
        @click="handleEpisodeSelect(episode)"
      />
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
@media (max-width: 1024px) {
  .series-playlist-page {
    margin: 0 0 0 16px;
    padding: 12px 16px 24px 0;
  }
}
</style>
