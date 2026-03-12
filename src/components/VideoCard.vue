<script setup>
defineProps({
  thumbnail: { type: String, default: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?q=80&w=400&h=225&auto=format&fit=crop' },
  duration: { type: String, default: '12:34' },
  title: { type: String, default: 'Cosmic Journey: The Edge of Universe' },
  creator: { type: String, default: 'Aether Media' },
  views: { type: String, default: '7.2M views' },
  date: { type: String, default: '1 day ago' },
  isNeon: { type: Boolean, default: false }
});
</script>

<template>
  <div class="video-card">
    <div class="thumbnail">
      <img :src="thumbnail" alt="Thumbnail" />
      <span class="duration badge">{{ duration }}</span>
    </div>
    <div class="info">
      <h3 class="title" :class="{ 'neon-title': isNeon }">{{ title }}</h3>
      <div class="metadata">
        <span class="creator">{{ creator }}</span>
        <span class="stats">{{ views }} • {{ date }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  display: flex;
  gap: 12px;
  border-radius: 8px;
  padding: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.video-card:hover {
  background: var(--interactive-hover);
  transform: translateX(4px);
}

.thumbnail {
  position: relative;
  width: 160px;
  height: 90px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.video-card:hover .thumbnail img {
  transform: scale(1.05);
}

.badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  backdrop-filter: blur(4px);
}

.info {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
  margin: 0;
}

.neon-title {
  color: var(--accent-neon);
  text-shadow: 0 0 8px rgba(162, 82, 255, 0.4);
}

.metadata {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

@media (max-width: 1024px) {
  .video-card {
    flex-direction: column;
  }
  .thumbnail {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }
}
</style>
