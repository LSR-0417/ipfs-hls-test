<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  title: { type: String, default: 'IPFS Video Stream' },
  cid: { type: String, default: '' },
  gateway: { type: String, default: '' },
  views: { type: String, default: 'Decentralized' },
  date: { type: String, default: 'Live' },
});

const shareSuccess = ref(false);

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
  if (props.gateway) {
    shareUrl.searchParams.set('gateway', props.gateway);
  }
  if (currentTime > 0) {
    shareUrl.searchParams.set('t', currentTime);
  }

  const urlStr = shareUrl.toString();

  const handleSuccess = () => {
    shareSuccess.value = true;
    setTimeout(() => { shareSuccess.value = false; }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(urlStr).then(handleSuccess).catch(err => {
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
  } catch (err) {
    alert('複製失敗，請手動複製這段網址:\n' + text);
  }
  document.body.removeChild(textArea);
}
</script>

<template>
  <div class="video-info glass-panel">
    <h1 class="title">{{ title }} <span v-if="cid" class="cid-badge">[{{ cid.slice(0,6) }}...{{ cid.slice(-4) }}]</span></h1>
    
    <div class="info-row">
      <div class="creator-info">
        <div class="avatar">
          <img src="https://api.dicebear.com/7.x/identicon/svg?seed=IPFS" alt="Creator" />
        </div>
        <div class="creator-text">
          <div class="creator-name">IPFS Node <svg viewBox="0 0 24 24" width="16" height="16" class="verified"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
          <div class="subscribers">Decentralized Network</div>
        </div>
        <button class="subscribe-btn glass-btn">Follow</button>
      </div>

      <div class="actions">
        <div class="action-group glass-btn">
          <button class="like-btn" title="Like"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg> 1.2M</button>
          <div class="divider"></div>
          <button class="dislike-btn" title="Dislike"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg></button>
        </div>
        
        <button class="glass-btn action-btn" @click="shareCurrentTime" :class="{'success-text': shareSuccess}" title="Share Video (Copy Link)">
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
    
    <div class="description glass-panel-inner">
      <p class="stats">{{ views }} views • {{ date }}</p>
      <p class="desc-text">
        Playing decentralized video content from IPFS. Ensuring censorship resistance and high availability through peer-to-peer networking.
        <br><br>
        <span class="hashtag">#IPFS</span> <span class="hashtag">#Web3</span> <span class="hashtag">#Decentralized</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.video-info {
  padding: 20px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title {
  font-size: 1.4rem;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cid-badge {
  font-size: 0.8rem;
  padding: 4px 8px;
  background: rgba(162, 82, 255, 0.2);
  color: var(--accent-neon);
  border-radius: 16px;
  font-weight: 500;
  border: 1px solid rgba(162, 82, 255, 0.4);
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

.stats {
  font-weight: 600;
  margin-bottom: 8px;
}

.desc-text {
  color: var(--text-secondary);
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
  .title {
    font-size: 1.2rem;
  }
  .info-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .actions {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }
  .btn-text {
    display: none; /* Hide text on mobile for small icon buttons */
  }
  .action-btn {
    padding: 8px 12px;
  }
  .hide-mobile {
    display: none; /* Can hide less important buttons on mobile to save space */
  }
}
</style>
