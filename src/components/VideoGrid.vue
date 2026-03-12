<script setup>
import VideoCard from './VideoCard.vue';
</script>

<template>
  <div class="video-grid">
    <VideoCard 
      thumbnail="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&h=225&auto=format&fit=crop"
      title="Cybernetic Dreams: The AI Awakening"
      duration="22:40"
      views="1.5M views"
      isNeon="true"
    />
    <VideoCard 
      thumbnail="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&h=225&auto=format&fit=crop"
      title="Into the Void: Black Holes Explained"
      duration="14:15"
      views="890K views"
    />
    <VideoCard 
      thumbnail="https://images.unsplash.com/photo-1549692520-acc6669e2f0c?q=80&w=400&h=225&auto=format&fit=crop"
      title="Neon City Walking Tour 4K"
      duration="1:05:22"
      views="2.1M views"
      creator="CityWalks"
    />
    <VideoCard 
      thumbnail="https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?q=80&w=400&h=225&auto=format&fit=crop"
      title="Stargazer Series: Episode 1"
      duration="45:00"
      views="500K views"
      creator="Astral Labs"
    />
  </div>
</template>

<style scoped>
.video-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (max-width: 1024px) {
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
}
</style>
