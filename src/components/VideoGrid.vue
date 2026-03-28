<script setup>
import SidebarVideoListItem from './SidebarVideoListItem.vue';

const recommendationItems = Object.freeze([
  {
    id: 'cybernetic-dreams',
    thumbnail: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&h=225&auto=format&fit=crop',
    title: 'Cybernetic Dreams: The AI Awakening',
    duration: '22:40',
    creator: 'Aether Media',
    meta: '1.5M views • 1 day ago',
    accented: true,
  },
  {
    id: 'black-holes-explained',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&h=225&auto=format&fit=crop',
    title: 'Into the Void: Black Holes Explained',
    duration: '14:15',
    creator: 'Aether Media',
    meta: '890K views • 3 days ago',
    accented: false,
  },
  {
    id: 'neon-city-tour',
    thumbnail: 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?q=80&w=400&h=225&auto=format&fit=crop',
    title: 'Neon City Walking Tour 4K',
    duration: '1:05:22',
    creator: 'CityWalks',
    meta: '2.1M views • 5 days ago',
    accented: false,
  },
  {
    id: 'stargazer-episode-1',
    thumbnail: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?q=80&w=400&h=225&auto=format&fit=crop',
    title: 'Stargazer Series: Episode 1',
    duration: '45:00',
    creator: 'Astral Labs',
    meta: '500K views • 1 week ago',
    accented: false,
  },
]);
</script>

<template>
  <div class="video-grid" data-testid="video-grid">
    <SidebarVideoListItem
      v-for="item in recommendationItems"
      :key="item.id"
      class="recommendations-item"
      :thumbnail="item.thumbnail"
      :title="item.title"
      :duration="item.duration"
      :secondary-text="item.creator"
      :tertiary-text="item.meta"
      tertiary-variant="meta"
      :accented="item.accented"
    />
  </div>
</template>

<style scoped>
.video-grid {
  display: grid;
  gap: 2px;
}
</style>
