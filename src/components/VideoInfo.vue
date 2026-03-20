<script setup>
import { computed, ref, watch } from 'vue';
import {
  buildSidecarAssetUrl,
  createDefaultVideoInfo,
  formatRelativeUploadTime,
  formatUploadDate,
  formatUploadDateTooltip,
} from '../utils/videoInfo';

const defaultDescription =
  'Playing decentralized video content from IPFS. Ensuring censorship resistance and high availability through peer-to-peer networking.';
const defaultTags = ['IPFS', 'Web3', 'Decentralized'];

const props = defineProps({
  cid: { type: String, default: '' },
  ipfsBaseUrl: { type: String, default: '' },
  videoInfo: {
    type: Object,
    default: () => createDefaultVideoInfo(),
  },
});

const shareSuccess = ref(false);
const avatarLoadFailed = ref(false);

const displayUploader = computed(() => props.videoInfo.uploader || 'IPFS Node');
const displayChannelText = computed(() => {
  if (props.videoInfo.channelId) {
    return `Channel ID: ${props.videoInfo.channelId}`;
  }

  if (props.videoInfo.categories.length > 0) {
    return props.videoInfo.categories.join(' • ');
  }

  return 'Decentralized Network';
});
const fallbackAvatarUrl = computed(() => {
  const seed = props.videoInfo.channelId || props.videoInfo.uploader || props.cid || 'IPFS';
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
});
const avatarUrl = computed(() => {
  if (avatarLoadFailed.value) {
    return fallbackAvatarUrl.value;
  }

  return buildSidecarAssetUrl(props.ipfsBaseUrl, 'avatar.jpg') || fallbackAvatarUrl.value;
});
const displayUploadDateTooltip = computed(() => formatUploadDateTooltip(props.videoInfo.uploadDate));
const displayRelativeUploadTime = computed(() => {
  return formatRelativeUploadTime(props.videoInfo.uploadDate) || formatUploadDate(props.videoInfo.uploadDate);
});
const displayStatsItems = computed(() => {
  const items = [];

  if (displayRelativeUploadTime.value) {
    items.push({
      value: displayRelativeUploadTime.value,
      className: 'stats-upload-time',
    });
  }

  return items;
});
const displayDescription = computed(() => props.videoInfo.description || defaultDescription);
const displayTags = computed(() => {
  const tags = props.videoInfo.tags.length > 0 ? props.videoInfo.tags : defaultTags;
  return tags;
});
const metadataItems = computed(() => {
  const items = [
    { label: 'IPFS CID', value: props.cid },
    { label: 'Video ID', value: props.videoInfo.id },
    { label: 'Uploader', value: props.videoInfo.uploader },
    { label: 'Channel ID', value: props.videoInfo.channelId },
    { label: 'Duration', value: props.videoInfo.durationString },
    { label: 'Frame Rate', value: props.videoInfo.fps ? `${props.videoInfo.fps} fps` : '' },
  ];

  return items.filter((item) => item.value);
});

watch(
  () => [props.cid, props.ipfsBaseUrl],
  () => {
    avatarLoadFailed.value = false;
  },
  { immediate: true }
);

function shareCurrentTime() {
  if (!props.cid) {
    alert('無有效的 CID！');
    return;
  }

  let currentTime = 0;
  if (window.videojs && window.videojs.getAllPlayers().length > 0) {
    currentTime = Math.floor(window.videojs.getAllPlayers()[0].currentTime());
  } else {
    const video = document.querySelector('video');
    if (video) {
      currentTime = Math.floor(video.currentTime);
    }
  }

  const shareUrl = new URL(window.location.origin + window.location.pathname);
  shareUrl.searchParams.set('cid', props.cid);
  if (currentTime > 0) {
    shareUrl.searchParams.set('t', currentTime);
  }

  const urlStr = shareUrl.toString();

  const handleSuccess = () => {
    shareSuccess.value = true;
    setTimeout(() => {
      shareSuccess.value = false;
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(urlStr).then(handleSuccess).catch(() => {
      fallbackCopyTextToClipboard(urlStr, handleSuccess);
    });
  } else {
    fallbackCopyTextToClipboard(urlStr, handleSuccess);
  }
}

function fallbackCopyTextToClipboard(text, onSuccess) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    if (document.execCommand('copy')) onSuccess();
  } catch (_) {
    alert(`複製失敗，請手動複製這段網址:\n${text}`);
  }
  document.body.removeChild(textArea);
}

function formatTag(tag) {
  return String(tag || '').trim().replace(/^#+/, '');
}

function handleAvatarError() {
  avatarLoadFailed.value = true;
}
</script>

<template>
  <div class="video-info">
    <div class="info-row">
      <div class="creator-info">
        <div class="avatar">
          <img :src="avatarUrl" :alt="displayUploader" @error="handleAvatarError" />
        </div>
        <div class="creator-text">
          <div class="creator-name">{{ displayUploader }} <svg viewBox="0 0 24 24" width="16" height="16" class="verified"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
          <div class="subscribers">{{ displayChannelText }}</div>
        </div>
        <button class="subscribe-btn glass-btn">Follow</button>
      </div>

      <div class="actions">
        <div class="action-group glass-btn">
          <button class="like-btn" title="Like"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg> 1.2M</button>
          <div class="divider"></div>
          <button class="dislike-btn" title="Dislike"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg></button>
        </div>

        <button class="glass-btn action-btn" @click="shareCurrentTime" :class="{ 'success-text': shareSuccess }" title="Share Video (Copy Link)">
          <svg v-if="!shareSuccess" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" class="success-icon"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span class="btn-text">{{ shareSuccess ? 'Copied!' : 'Share' }}</span>
        </button>

        <button class="glass-btn action-btn hide-mobile">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>
          <span class="btn-text">Download</span>
        </button>
      </div>
    </div>

    <div class="description glass-panel">
      <div v-if="displayStatsItems.length > 0" class="stats-panel">
        <p class="stats">
          <template v-for="(item, index) in displayStatsItems" :key="`${item.value}-${index}`">
            <span v-if="index > 0" class="stats-separator">•</span>
            <span class="stats-item" :class="item.className">{{ item.value }}</span>
          </template>
        </p>
        <span v-if="displayUploadDateTooltip" class="stats-tooltip">{{ displayUploadDateTooltip }}</span>
      </div>
      <p class="desc-text">{{ displayDescription }}</p>
      <div v-if="metadataItems.length > 0" class="metadata-grid">
        <div v-for="item in metadataItems" :key="item.label" class="metadata-item">
          <span class="metadata-label">{{ item.label }}</span>
          <span class="metadata-value">{{ item.value }}</span>
        </div>
      </div>
      <p class="tag-list">
        <span v-for="(tag, index) in displayTags" :key="`${tag}-${index}`" class="hashtag">#{{ formatTag(tag) }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.video-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a1a2e;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-text {
  display: flex;
  flex-direction: column;
}

.creator-name {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.verified {
  color: var(--accent-cyan);
}

.subscribers {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.glass-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.glass-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.subscribe-btn {
  margin-left: 12px;
  background: rgba(0, 210, 255, 0.1);
  color: var(--accent-cyan);
  border-color: rgba(0, 210, 255, 0.3);
}

.subscribe-btn:hover {
  background: rgba(0, 210, 255, 0.2);
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.action-group button {
  background: transparent;
  border: none;
  color: inherit;
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: background 0.2s;
}

.action-group button:hover {
  background: rgba(255, 255, 255, 0.05);
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.description {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.stats-panel {
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  position: relative;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-weight: 400;
  margin: 0;
  line-height: 1.35;
}

.stats-tooltip {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
  z-index: 6;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(10, 12, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  color: var(--text-primary);
  font-size: 0.85rem;
  line-height: 1.25;
  white-space: nowrap;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.stats-panel:hover .stats-tooltip {
  opacity: 1;
  transform: translateY(0);
}

.stats-item {
  color: inherit;
}

.stats-upload-time {
  text-decoration: none;
}

.stats-separator {
  color: inherit;
}

.desc-text {
  color: var(--text-secondary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.metadata-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.metadata-value {
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hashtag {
  color: var(--accent-cyan);
  cursor: pointer;
}

.hashtag:hover {
  text-decoration: underline;
}

.success-text {
  color: var(--accent-cyan);
  border-color: rgba(0, 210, 255, 0.4);
}

.success-icon {
  color: var(--accent-cyan);
}

@media (max-width: 600px) {
  .info-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .actions {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
    margin-left: 0;
  }

  .btn-text {
    display: none;
  }

  .action-btn {
    padding: 8px 12px;
  }

  .hide-mobile {
    display: none;
  }
}
</style>
