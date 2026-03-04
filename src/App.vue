<script setup>
import { ref } from 'vue';
import ControlPanel from './components/ControlPanel.vue';
import VideoPlayer from './components/VideoPlayer.vue';

const status = ref('準備就緒');
const currentM3u8Url = ref('');
const currentIpfsBaseUrl = ref('');
const currentStartTime = ref(0);
const playerRef = ref(null);

function onLoad({ ipfsBaseUrl, m3u8Url, startTime }) {
  currentIpfsBaseUrl.value = ipfsBaseUrl;
  currentM3u8Url.value = m3u8Url;
  currentStartTime.value = startTime;
}

function onStatusUpdate(newStatus) {
  status.value = newStatus;
}

function onLevelsLoaded(levels) {}
</script>

<template>
  <div class="container">
    <h2>🚀 IPFS 串流播放器</h2>

    <ControlPanel @load="onLoad" @play-status="onStatusUpdate" />

    <VideoPlayer
      ref="playerRef"
      :m3u8-url="currentM3u8Url"
      :ipfs-base-url="currentIpfsBaseUrl"
      :start-time="currentStartTime"
      @status-update="onStatusUpdate"
      @levels-loaded="onLevelsLoaded"
    />
    <div id="status">{{ status }}</div>
  </div>
</template>

<style src="./App.css"></style>
