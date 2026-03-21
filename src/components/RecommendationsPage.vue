<script setup>
import VideoGrid from './VideoGrid.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();
</script>

<template>
  <section class="recommendations-page" data-testid="recommendations-page">
    <h2 class="recommendations-title" data-testid="recommendations-title">{{ t('recommendations.title') }}</h2>
    <VideoGrid />
  </section>
</template>

<style scoped>
.recommendations-page {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
  margin: 0 0 0 16px;
  padding: 12px 16px 0 0;
}

.recommendations-page > * {
  width: 100%;
  margin: 0;
}

@media (min-width: 1024px) {
  .recommendations-page {
    flex: 0 0 380px;
  }
}

.recommendations-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
