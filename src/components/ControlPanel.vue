<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['play', 'play-status']);

const cid = ref('');
const gateway = ref('/ipfs/');

const gateways = [
  { url: '/ipfs/', label: '本地 (最穩定/測試首選)' },
  { url: 'https://gateway.pinata.cloud/ipfs/', label: 'Pinata (速度快/推薦)' },
  { url: 'https://dweb.link/ipfs/', label: 'DWeb.link (官方推薦)' },
  { url: 'https://ipfs.io/ipfs/', label: 'IPFS.io (標準網關)' },
];

function playVideo(eventOrStartTime) {
  const startTime = typeof eventOrStartTime === 'number' ? eventOrStartTime : 0;
  const trimmed = cid.value.trim();
  if (!trimmed) {
    alert('請先輸入 CID！');
    return;
  }

  const selectedGateway = gateway.value;
  let ipfsBaseUrl;
  if (selectedGateway.startsWith('/') || selectedGateway.startsWith('./')) {
    // 讓請求使用相對路徑 (例如 /ipfs/...)，這樣才會正確觸發 vite.config.js 的 proxy 來避免 CORS 問題
    ipfsBaseUrl = `${selectedGateway}${trimmed}/`;
  } else {
    ipfsBaseUrl = `${selectedGateway}${trimmed}/`;
  }
  const m3u8Url = `${ipfsBaseUrl}output.m3u8`;

  emit('play-status', '正在連線至網關...');
  emit('play', { ipfsBaseUrl, m3u8Url, startTime });

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('cid', trimmed);
  if (startTime > 0) {
    currentUrl.searchParams.set('t', startTime);
  } else {
    currentUrl.searchParams.delete('t');
  }
  window.history.pushState({}, '', currentUrl);
}

function shareCurrentTime() {
  const trimmed = cid.value.trim();
  if (!trimmed) {
    alert('請先輸入或載入 CID！');
    return;
  }

  const video = document.querySelector('video');
  if (!video) return;

  const currentTime = Math.floor(video.currentTime);
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('cid', trimmed);
  if (currentTime > 0) shareUrl.searchParams.set('t', currentTime);

  navigator.clipboard
    .writeText(shareUrl.toString())
    .then(() => {
      const btnText = document.querySelector('#shareBtn .btn-text');
      const btnIcon = document.querySelector('#shareBtn .btn-icon');
      if (btnText && btnIcon) {
        btnText.textContent = '✅ 已複製！';
        btnIcon.textContent = '✅';
        setTimeout(() => {
          if (btnText) btnText.textContent = '🔗 分享片段';
          if (btnIcon) btnIcon.textContent = '🔗';
        }, 2000);
      } else {
        const btn = document.getElementById('shareBtn');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = '✅ 已複製！';
          setTimeout(() => {
            if (btn) btn.textContent = original;
          }, 2000);
        }
      }
    })
    .catch(() => {
      alert('複製失敗，請手動複製網址列。');
    });
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const cidFromUrl = urlParams.get('cid');
  const timeFromUrl = parseInt(urlParams.get('t'), 10) || 0;

  if (cidFromUrl) {
    cid.value = cidFromUrl;
    playVideo(timeFromUrl);
  }
});
</script>

<template>
  <div class="control-panel">
    <div class="input-row">
      <label for="gatewaySelect">選擇網關：</label>
      <select id="gatewaySelect" v-model="gateway">
        <option v-for="g in gateways" :key="g.url" :value="g.url">
          {{ g.label }}
        </option>
      </select>
    </div>

    <div class="input-row">
      <input
        type="text"
        id="cidInput"
        placeholder="請輸入資料夾 CID (例如: Qm...)"
        v-model="cid"
        @keyup.enter="playVideo"
      />
      <button @click="playVideo" class="action-btn">
        <span class="btn-text">▶️ 載入影片</span>
        <span class="btn-icon">▶️</span>
      </button>
      <button
        @click="shareCurrentTime"
        id="shareBtn"
        class="action-btn"
        title="複製包含目前播放時間的連結"
      >
        <span class="btn-text">🔗 分享片段</span>
        <span class="btn-icon">🔗</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="./ControlPanel.css"></style>
